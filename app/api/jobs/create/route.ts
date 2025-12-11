import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Database } from '@/types/database'
import { requireVerifiedWallet } from '@/lib/middleware'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/create
 * 
 * Create a new job with escrow locking
 * 
 * Required: Escrow transaction must be completed before calling this endpoint
 * Server validates the transaction on-chain before creating the job
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const {
      project_id,
      poster_wallet,
      title,
      description,
      kpis,
      category,
      payment_amount_tokens,
      payment_amount_usd,
      assignment_mode,
      escrow_tx_signature,
      escrow_locked,
      escrow_amount_tokens,
      escrow_token_mint,
      poster_desired_completion,
      fee_percentage_at_creation,
      token_symbol
    } = body

    // Validate required fields
    if (!project_id || !poster_wallet || !title || !description || !kpis || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify wallet is verified before allowing job creation
    const verificationCheck = await requireVerifiedWallet(poster_wallet)
    if (!verificationCheck.verified) {
      return NextResponse.json(
        { error: 'Wallet verification required to create jobs' },
        { status: 403 }
      )
    }

    if (!payment_amount_tokens || payment_amount_tokens <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // Validate escrow fields
    if (!escrow_tx_signature || !escrow_locked) {
      return NextResponse.json(
        { error: 'Escrow transaction signature required' },
        { status: 400 }
      )
    }

    if (!escrow_amount_tokens || !escrow_token_mint) {
      return NextResponse.json(
        { error: 'Missing escrow details' },
        { status: 400 }
      )
    }

    console.log('Creating job with escrow:', {
      project_id,
      poster_wallet,
      title,
      escrow_tx_signature,
      escrow_amount_tokens
    })

    // Verify transaction on-chain (recommended for security)
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    
    if (!rpcUrl) {
      console.error('No RPC URL configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const connection = new Connection(rpcUrl, 'confirmed')
    
    try {
      console.log('Verifying transaction on-chain:', escrow_tx_signature)
      
      const tx = await connection.getTransaction(escrow_tx_signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })
      
      if (!tx) {
        console.error('Transaction not found on-chain:', escrow_tx_signature)
        return NextResponse.json(
          { error: 'Transaction not found or not yet confirmed. Please wait and try again.' },
          { status: 400 }
        )
      }

      if (tx.meta?.err) {
        console.error('Transaction failed on-chain:', tx.meta.err)
        return NextResponse.json(
          { error: 'Transaction failed on blockchain' },
          { status: 400 }
        )
      }

      console.log('Transaction verified successfully')
      
      // TODO: Additional verification
      // - Verify sender matches poster_wallet
      // - Verify recipient is escrow wallet
      // - Verify amount matches escrow_amount_tokens
      // This requires parsing transaction details which can be complex
      
    } catch (txError: any) {
      console.error('Transaction verification error:', txError)
      
      // If transaction is not found, it might still be confirming
      // Allow creation but log the error
      if (txError.message?.includes('not found')) {
        console.warn('Transaction not yet confirmed, proceeding with caution')
      } else {
        // Other errors should fail the request
        return NextResponse.json(
          { error: 'Failed to verify transaction on-chain' },
          { status: 400 }
        )
      }
    }

    // Create job in database
    console.log('Inserting job into database...')
    
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        project_id,
        poster_wallet,
        title,
        description,
        kpis,
        category,
        payment_amount_tokens,
        payment_amount_usd: payment_amount_usd || 0,
        assignment_mode: assignment_mode || 'review',
        status: 'open',
        escrow_tx_signature,
        escrow_locked,
        escrow_amount_tokens,
        escrow_token_mint,
        poster_desired_completion: poster_desired_completion || null,
        fee_percentage_at_creation: fee_percentage_at_creation || 5.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (jobError) {
      console.error('Job creation failed:', jobError)
      return NextResponse.json(
        { 
          error: 'Failed to create job in database',
          details: jobError.message 
        },
        { status: 500 }
      )
    }

    console.log('Job created successfully:', job.id)

    // Get escrow wallet address from platform settings
    const { data: escrowWalletSetting } = await supabaseAdmin
      .rpc('get_platform_setting', { 
        p_setting_key: 'escrow_wallet_address' 
      })

    const escrowWallet = escrowWalletSetting || process.env.ESCROW_WALLET_ADDRESS || 'UNKNOWN'

    // Create escrow transaction record for audit trail
    console.log('Creating escrow transaction record...')
    
    const { error: escrowError } = await supabaseAdmin
      .from('job_escrow_transactions')
      .insert({
        job_id: job.id,
        transaction_type: 'lock',
        from_wallet: poster_wallet,
        to_wallet: escrowWallet,
        amount_tokens: escrow_amount_tokens,
        token_mint: escrow_token_mint,
        token_symbol: token_symbol || 'UNKNOWN',
        tx_signature: escrow_tx_signature,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
    
    if (escrowError) {
      console.error('Escrow transaction record failed:', escrowError)
      // Non-critical - job is still created
      // Log but don't fail the request
    } else {
      console.log('Escrow transaction record created')
    }

    // Award karma to poster for creating job
    try {
      const { error: karmaError } = await supabaseAdmin
        .rpc('award_karma', {
          p_wallet_address: poster_wallet,
          p_project_id: project_id,
          p_amount: 50,
          p_reason: 'job_posted'
        })
      
      if (karmaError) {
        console.error('Failed to award karma:', karmaError)
        // Non-critical
      } else {
        console.log('Karma awarded to poster')
      }
    } catch (karmaErr) {
      console.error('Karma error:', karmaErr)
      // Non-critical
    }

    console.log('Job creation complete:', job.id)

    return NextResponse.json({ 
      success: true, 
      job 
    }, { status: 201 })
    
  } catch (error: any) {
    console.error('Job creation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/create
 * Returns method not allowed
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}









