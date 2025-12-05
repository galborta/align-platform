import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection } from '@solana/web3.js'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/admin/jobs/recover-escrow
 * 
 * Recovery endpoint for jobs where escrow was locked but job creation failed.
 * This creates the job record using the verified on-chain transaction.
 * 
 * ADMIN ONLY - requires admin wallet verification
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const {
      admin_wallet,
      escrow_tx_signature,
      project_id,
      poster_wallet,
      title,
      description,
      kpis,
      category,
      payment_amount_tokens,
      payment_amount_usd,
      assignment_mode,
      escrow_amount_tokens,
      escrow_token_mint,
      token_symbol,
      poster_desired_completion,
      // Contest fields
      is_contest,
      contest_max_winners,
      contest_winner_prizes,
      contest_submission_deadline,
      contest_winner_selection_deadline,
      contest_submissions_visible
    } = body

    // Verify admin wallet
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_wallets')
      .select('wallet_address')
      .eq('wallet_address', admin_wallet)
      .single()

    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Unauthorized - admin wallet required' },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!escrow_tx_signature) {
      return NextResponse.json(
        { error: 'Escrow transaction signature is required' },
        { status: 400 }
      )
    }

    if (!project_id || !poster_wallet || !title || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required job fields' },
        { status: 400 }
      )
    }

    // Check if job already exists with this transaction
    const { data: existingJob } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('escrow_tx_signature', escrow_tx_signature)
      .single()

    if (existingJob) {
      return NextResponse.json(
        { error: 'Job already exists with this transaction signature', job_id: existingJob.id },
        { status: 409 }
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
        { error: 'Transaction not found on-chain' },
        { status: 400 }
      )
    }

    if (tx.meta?.err) {
      return NextResponse.json(
        { error: 'Transaction failed on-chain', details: tx.meta.err },
        { status: 400 }
      )
    }

    console.log('[Recovery] Transaction verified, creating job...')

    // Create job in database
    const jobData: any = {
      project_id,
      poster_wallet,
      title,
      description,
      kpis: kpis || '',
      category,
      payment_amount_tokens: payment_amount_tokens || escrow_amount_tokens || 0,
      payment_amount_usd: payment_amount_usd || 0,
      assignment_mode: assignment_mode || 'review',
      status: 'open',
      escrow_tx_signature,
      escrow_locked: true,
      escrow_amount_tokens: escrow_amount_tokens || payment_amount_tokens || 0,
      escrow_token_mint: escrow_token_mint || null,
      poster_desired_completion: poster_desired_completion || null,
      fee_percentage_at_creation: 5.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Add contest fields if this is a contest
    if (is_contest) {
      jobData.is_contest = true
      jobData.contest_max_winners = contest_max_winners || 1
      jobData.contest_winner_prizes = contest_winner_prizes || null
      jobData.contest_submission_deadline = contest_submission_deadline || null
      jobData.contest_winner_selection_deadline = contest_winner_selection_deadline || null
      jobData.contest_submissions_visible = contest_submissions_visible ?? true
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

    // Get escrow wallet address
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
        amount_tokens: escrow_amount_tokens || payment_amount_tokens || 0,
        token_mint: escrow_token_mint || 'UNKNOWN',
        token_symbol: token_symbol || 'UNKNOWN',
        tx_signature: escrow_tx_signature,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        notes: 'Recovered via admin endpoint',
        created_at: new Date().toISOString()
      })

    // Log the recovery action
    console.log('[Recovery] Success:', {
      job_id: job.id,
      tx_signature: escrow_tx_signature,
      recovered_by: admin_wallet
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Job recovered successfully',
      job 
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

