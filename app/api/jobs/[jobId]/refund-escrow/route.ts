import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import { refundEscrowToPoster } from '@/lib/solana/escrow-refund'
import { Database } from '@/types/database'
import { verifyRequestSignature } from '@/lib/signature-auth'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/refund-escrow
 * 
 * Refunds all tokens locked in escrow back to the job poster when a job is cancelled.
 * 
 * Authentication:
 * - Requires wallet signature verification
 * - User's wallet must match the job poster's wallet OR be an active admin
 * 
 * Returns:
 * - 200: { success: true, txSignature: string, amountRefunded: number }
 * - 400: { error: string } - Invalid request
 * - 401: { error: string } - Unauthorized (missing/invalid token)
 * - 403: { error: string } - Forbidden (not the poster or admin)
 * - 404: { error: string } - Job not found
 * - 500: { error: string } - Internal server error
 * 
 * Process:
 * 1. Authenticates user via wallet signature
 * 2. Fetches job details from database
 * 3. Verifies authenticated user's wallet matches job poster OR is an active admin
 * 4. Verifies escrow is locked
 * 5. Processes full refund (payment + fee) back to poster
 * 6. Logs transaction to job_escrow_transactions table
 * 
 * Security:
 * - CRITICAL: Uses cryptographic signature authentication
 * - Only the authenticated job poster OR active admin can request a refund
 * - Admin override logged for audit trail
 * - Requires escrow to be locked (escrow_locked = true)
 * - Uses secure escrow wallet private key from environment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { jobId } = await params

    // Validate jobId is provided
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    console.log(`[Refund API] Processing refund for job ${jobId}`)

    // ==================== AUTHENTICATION ====================
    // Verify cryptographic signature proving wallet ownership
    
    const body = await request.json()
    const { wallet, signature, message } = body

    console.log('='.repeat(80))
    console.log('[REFUND API DEBUG] REQUEST BODY RECEIVED:')
    console.log('Wallet:', wallet)
    console.log('Signature:', signature)
    console.log('Message:', message)
    console.log('='.repeat(80))

    // Accept both "Refund escrow" and "Cancel job and refund" actions
    let authResult = verifyRequestSignature(
      { wallet, signature, message },
      {
        action: 'Cancel job and refund',
        resourceId: jobId,
        maxAge: 2 * 60 * 1000 // 2 minutes
      }
      )
    
    // Fallback to old action name for backwards compatibility
    if (!authResult.success) {
      authResult = verifyRequestSignature(
        { wallet, signature, message },
        {
          action: 'Refund escrow',
          resourceId: jobId,
          maxAge: 2 * 60 * 1000 // 2 minutes
        }
      )
    }

    if (!authResult.success) {
      console.error('[Refund API] Signature verification failed:', authResult.error)
      return NextResponse.json(
        { error: authResult.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    const authenticatedWallet = authResult.wallet!
    console.log(`[Refund API] ✅ Authenticated via signature: ${authenticatedWallet.slice(0, 8)}...`)
    console.log(`[Refund API] User wallet: ${authenticatedWallet}`)

    // ==================== GET JOB DETAILS ====================

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Refund API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== AUTHORIZATION ====================
    
    console.log('[Refund API] Authorization check:')
    console.log('  Job poster wallet:', job.poster_wallet)
    console.log('  Authenticated wallet:', authenticatedWallet)
    console.log('  Match:', job.poster_wallet === authenticatedWallet)

    // Check if user is an admin (admin override for job deletion)
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_wallets')
      .select('wallet_address, role, is_active')
      .eq('wallet_address', authenticatedWallet)
      .eq('is_active', true)
      .maybeSingle()

    const isAdmin = !!adminCheck

    console.log('[Refund API] Admin check:', {
      wallet: authenticatedWallet,
      isAdmin,
      role: adminCheck?.role
    })

    // Verify authenticated user is either the job poster OR an admin
    if (job.poster_wallet !== authenticatedWallet && !isAdmin) {
      console.warn(`[Refund API] Unauthorized refund attempt by ${authenticatedWallet}`)
      return NextResponse.json(
        { error: 'Only the job poster or an admin can request a refund' },
        { status: 403 }
      )
    }

    if (isAdmin && job.poster_wallet !== authenticatedWallet) {
      console.log(`[Refund API] ⚠️  Admin override: ${authenticatedWallet} (${adminCheck?.role}) refunding job on behalf of poster ${job.poster_wallet}`)
    } else {
      console.log('[Refund API] ✅ Poster verified via signature')
    }

    // Verify escrow is locked
    if (!job.escrow_locked) {
      console.log('[Refund API] No escrow locked for this job')
      return NextResponse.json(
        { error: 'No escrow to refund. Tokens may have already been refunded.' },
        { status: 400 }
      )
    }

    // Verify escrow data exists
    if (!job.escrow_amount_tokens || !job.escrow_token_mint) {
      console.error('[Refund API] Missing escrow data')
      return NextResponse.json(
        { error: 'Invalid escrow data. Please contact support.' },
        { status: 400 }
      )
    }

    console.log(`[Refund API] Escrow amount: ${job.escrow_amount_tokens}`)
    console.log(`[Refund API] Token mint: ${job.escrow_token_mint}`)

    // Create Solana connection
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet')
    const connection = new Connection(rpcUrl, 'confirmed')
    console.log(`[Refund API] Using RPC: ${rpcUrl}`)

    // Process refund
    const result = await refundEscrowToPoster({
      connection,
      jobId: job.id,
      posterWallet: authenticatedWallet,
      tokenMint: job.escrow_token_mint,
      escrowAmount: job.escrow_amount_tokens,
      decimals: 9, // TODO: Get from token metadata or store in job
      jobTitle: job.title
    })

    if (!result.success) {
      console.error('[Refund API] Refund failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Refund transaction failed' },
        { status: 500 }
      )
    }

    console.log(`[Refund API] ✅ Refund successful`)
    console.log(`[Refund API] Tx signature: ${result.txSignature}`)
    console.log(`[Refund API] Amount refunded: ${result.amountRefunded}`)

    return NextResponse.json({
      success: true,
      txSignature: result.txSignature,
      amountRefunded: result.amountRefunded
    })

  } catch (error) {
    console.error('[Refund API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Please contact support if this persists'
      },
      { status: 500 }
    )
  }
}

