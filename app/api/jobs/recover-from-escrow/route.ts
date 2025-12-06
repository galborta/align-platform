import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/recover-from-escrow
 * 
 * User-facing endpoint to recover a job from a successful escrow transaction.
 * Unlike the admin endpoint, this verifies the poster wallet matches the transaction sender.
 * 
 * Request body:
 * - escrow_tx_signature: string (required) - The Solana transaction signature
 * - poster_wallet: string (required) - The wallet address that sent the tokens
 * - project_id: string (required) - The project ID
 * - title: string (required) - Job title
 * - description: string (required) - Job description
 * - kpis: string (optional) - Success criteria
 * - category: string (required) - Job category
 * - payment_amount_tokens: number (required) - Payment amount
 * - assignment_mode: string (optional) - 'review' or 'auto'
 * - token_symbol: string (optional) - Token symbol for display
 * 
 * Security:
 * - Verifies transaction exists on-chain
 * - Verifies transaction succeeded
 * - Verifies the poster_wallet was the sender in the transaction
 * - Checks no job already exists with this signature
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      escrow_tx_signature,
      poster_wallet,
      project_id,
      title,
      description,
      kpis,
      category,
      payment_amount_tokens,
      assignment_mode,
      token_symbol
    } = body

    // Validate required fields
    if (!escrow_tx_signature) {
      return NextResponse.json(
        { error: 'Escrow transaction signature is required' },
        { status: 400 }
      )
    }

    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Poster wallet is required' },
        { status: 400 }
      )
    }

    if (!project_id || !title || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required job fields (project_id, title, description, category)' },
        { status: 400 }
      )
    }

    if (!payment_amount_tokens || payment_amount_tokens <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount is required' },
        { status: 400 }
      )
    }

    console.log('[Recovery] Processing recovery request:', {
      tx: escrow_tx_signature.slice(0, 8) + '...',
      poster: poster_wallet.slice(0, 8) + '...',
      project: project_id
    })

    // Check if job already exists with this transaction
    const { data: existingJob } = await supabaseAdmin
      .from('jobs')
      .select('id, title')
      .eq('escrow_tx_signature', escrow_tx_signature)
      .single()

    if (existingJob) {
      return NextResponse.json(
        { 
          error: 'Job already exists with this transaction signature',
          existing_job_id: existingJob.id,
          existing_job_title: existingJob.title
        },
        { status: 409 }
      )
    }

    // Get project to fetch token info
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, token_mint, token_symbol, fee_percentage')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Verify transaction on-chain
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'Server configuration error - no RPC URL' },
        { status: 500 }
      )
    }

    const connection = new Connection(rpcUrl, 'confirmed')
    
    console.log('[Recovery] Verifying transaction:', escrow_tx_signature)
    
    const tx = await connection.getTransaction(escrow_tx_signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    })
    
    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found on-chain. It may still be processing - please try again in a few minutes.' },
        { status: 400 }
      )
    }

    if (tx.meta?.err) {
      return NextResponse.json(
        { error: 'Transaction failed on-chain', details: tx.meta.err },
        { status: 400 }
      )
    }

    // Verify the poster wallet was the fee payer (sender) of the transaction
    const accountKeys = tx.transaction.message.getAccountKeys()
    const feePayer = accountKeys.get(0)?.toBase58()
    
    if (feePayer !== poster_wallet) {
      console.warn('[Recovery] Wallet mismatch:', { feePayer, poster_wallet })
      return NextResponse.json(
        { 
          error: 'Wallet address does not match the transaction sender',
          expected: poster_wallet,
          actual: feePayer
        },
        { status: 403 }
      )
    }

    console.log('[Recovery] Transaction verified, creating job...')

    // Calculate escrow amount (payment + fee)
    const feePercentage = project.fee_percentage || 5.0
    const escrowAmount = payment_amount_tokens * (1 + feePercentage / 100)

    // Create job in database
    const jobData = {
      project_id,
      poster_wallet,
      title,
      description,
      kpis: kpis || '',
      category,
      payment_amount_tokens,
      payment_amount_usd: 0, // Will be updated later if needed
      assignment_mode: assignment_mode || 'review',
      status: 'open',
      escrow_tx_signature,
      escrow_locked: true,
      escrow_amount_tokens: escrowAmount,
      escrow_token_mint: project.token_mint,
      fee_percentage_at_creation: feePercentage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert(jobData)
      .select()
      .single()
    
    if (jobError) {
      console.error('[Recovery] Job creation failed:', jobError)
      return NextResponse.json(
        { 
          error: 'Failed to create job in database',
          details: jobError.message 
        },
        { status: 500 }
      )
    }

    console.log('[Recovery] Job created:', job.id)

    // Get escrow wallet address for transaction record
    const { data: escrowWalletSetting } = await (supabaseAdmin
      .rpc as any)('get_platform_setting', { 
        p_setting_key: 'escrow_wallet_address' 
      })

    const escrowWallet = escrowWalletSetting || process.env.ESCROW_WALLET_ADDRESS || 'UNKNOWN'

    // Create escrow transaction record
    await supabaseAdmin
      .from('job_escrow_transactions')
      .insert({
        job_id: job.id,
        transaction_type: 'lock',
        from_wallet: poster_wallet,
        to_wallet: escrowWallet,
        amount_tokens: escrowAmount,
        token_mint: project.token_mint || 'UNKNOWN',
        token_symbol: token_symbol || project.token_symbol || 'UNKNOWN',
        tx_signature: escrow_tx_signature,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        notes: 'Recovered via user recovery endpoint',
        created_at: new Date().toISOString()
      })

    // Mark any existing draft as recovered
    await supabaseAdmin
      .from('job_drafts')
      .update({
        recovery_status: 'recovered',
        updated_at: new Date().toISOString()
      })
      .eq('escrow_tx_signature', escrow_tx_signature)

    console.log('[Recovery] Success:', {
      job_id: job.id,
      tx_signature: escrow_tx_signature
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Job recovered successfully!',
      job: {
        id: job.id,
        title: job.title,
        payment_amount_tokens: job.payment_amount_tokens,
        escrow_amount_tokens: job.escrow_amount_tokens,
        status: job.status
      }
    }, { status: 201 })
    
  } catch (error: any) {
    console.error('[Recovery] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Recovery failed',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/recover-from-escrow
 * 
 * Check if a transaction signature can be recovered
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const txSignature = searchParams.get('tx')

  if (!txSignature) {
    return NextResponse.json(
      { error: 'Transaction signature (tx) query parameter is required' },
      { status: 400 }
    )
  }

  // Check if job already exists
  const { data: existingJob } = await supabaseAdmin
    .from('jobs')
    .select('id, title, status')
    .eq('escrow_tx_signature', txSignature)
    .single()

  if (existingJob) {
    return NextResponse.json({
      recoverable: false,
      reason: 'Job already exists with this transaction',
      job: existingJob
    })
  }

  // Check if draft exists
  const { data: existingDraft } = await supabaseAdmin
    .from('job_drafts')
    .select('id, draft_data, recovery_status')
    .eq('escrow_tx_signature', txSignature)
    .single()

  if (existingDraft) {
    return NextResponse.json({
      recoverable: true,
      has_draft: true,
      draft: existingDraft
    })
  }

  // Verify transaction exists on-chain
  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  
  if (rpcUrl) {
    const connection = new Connection(rpcUrl, 'confirmed')
    const tx = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    })

    if (tx && !tx.meta?.err) {
      return NextResponse.json({
        recoverable: true,
        has_draft: false,
        transaction_verified: true,
        message: 'Transaction found and succeeded. You can recover this job by providing the job details.'
      })
    } else if (tx?.meta?.err) {
      return NextResponse.json({
        recoverable: false,
        reason: 'Transaction failed on-chain',
        error: tx.meta.err
      })
    }
  }

  return NextResponse.json({
    recoverable: false,
    reason: 'Transaction not found on-chain'
  })
}

