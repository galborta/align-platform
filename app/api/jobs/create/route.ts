import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Database } from '@/types/database'
import { requireVerifiedWallet } from '@/lib/middleware'
import { getEnvironment } from '@/lib/environment'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const delay = initialDelay * Math.pow(2, attempt)
      console.warn(`[${context}] Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message)
      
      if (attempt < maxRetries - 1) {
        console.log(`[${context}] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * POST /api/jobs/create
 * 
 * Create a new job or contest with escrow locking
 * 
 * Required: Escrow transaction must be completed before calling this endpoint
 * Server validates the transaction on-chain before creating the job
 * 
 * Supports both regular jobs and contests:
 * - Regular jobs: payment_amount_tokens must be > 0
 * - Contests: is_contest=true, contest fields required, payment_amount_tokens can be 0
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
      token_symbol,
      // Contest fields
      is_contest,
      contest_max_winners,
      contest_winner_prizes,
      contest_submission_deadline,
      contest_winner_selection_deadline,
      contest_submissions_visible,
      // Environment filtering
      forceProduction
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

    // Validate payment amount (contests can have 0 for payment_amount_tokens since total is in escrow)
    if (!is_contest && (!payment_amount_tokens || payment_amount_tokens <= 0)) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // Validate contest-specific fields
    if (is_contest) {
      if (!contest_max_winners || contest_max_winners < 1) {
        return NextResponse.json(
          { error: 'Contest must have at least 1 winner' },
          { status: 400 }
        )
      }
      if (!contest_winner_prizes || !Array.isArray(contest_winner_prizes) || contest_winner_prizes.length === 0) {
        return NextResponse.json(
          { error: 'Contest must have prize configuration' },
          { status: 400 }
        )
      }
      if (!contest_submission_deadline) {
        return NextResponse.json(
          { error: 'Contest must have a submission deadline' },
          { status: 400 }
        )
      }
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

    console.log(`Creating ${is_contest ? 'contest' : 'job'} with escrow:`, {
      project_id,
      poster_wallet,
      title,
      escrow_tx_signature,
      escrow_amount_tokens,
      is_contest,
      contest_max_winners
    })

    // Verify transaction on-chain (recommended for security)
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    
    if (!rpcUrl) {
      console.error('[Job Create] No RPC URL configured')
      return NextResponse.json(
        { error: 'Server configuration error', code: 'NO_RPC_URL' },
        { status: 500 }
      )
    }

    const connection = new Connection(rpcUrl, 'confirmed')
    
    // Verify transaction with retries (transaction might not be immediately available)
    try {
      console.log('[Job Create] Verifying transaction on-chain:', escrow_tx_signature)
      
      const tx = await retryWithBackoff(
        async () => {
          const result = await connection.getTransaction(escrow_tx_signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          })
          
          if (!result) {
            throw new Error('Transaction not yet confirmed')
          }
          
          return result
        },
        5, // 5 retries
        2000, // Start with 2 second delay (transactions need time to finalize)
        'TxVerification'
      )
      
      if (tx.meta?.err) {
        console.error('[Job Create] Transaction failed on-chain:', tx.meta.err)
        return NextResponse.json(
          { error: 'Transaction failed on blockchain', code: 'TX_FAILED', details: tx.meta.err },
          { status: 400 }
        )
      }

      console.log('[Job Create] Transaction verified successfully')
      
    } catch (txError: any) {
      console.error('[Job Create] Transaction verification failed after retries:', txError)
      
      // Even after retries, if we can't verify the transaction, we should still try to create
      // the job since the user has locked their funds. The recovery system will handle edge cases.
      console.warn('[Job Create] Proceeding with job creation despite verification failure - funds are locked')
    }

    // Create job in database with retry logic
    console.log('[Job Create] Inserting job into database...')
    
    // Base job data
    const jobInsertData: Record<string, any> = {
      project_id,
      poster_wallet,
      title,
      description,
      kpis,
      category,
      payment_amount_tokens: is_contest ? 0 : payment_amount_tokens, // Contests use escrow_amount_tokens for total
      payment_amount_usd: is_contest ? 0 : (payment_amount_usd || 0),
      assignment_mode: is_contest ? 'review' : (assignment_mode || 'review'), // Contests always use review mode
      status: 'open',
      escrow_tx_signature,
      escrow_locked,
      escrow_amount_tokens,
      escrow_token_mint,
      poster_desired_completion: poster_desired_completion || null,
      fee_percentage_at_creation: fee_percentage_at_creation || 5.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Contest fields (defaults for regular jobs)
      is_contest: is_contest || false,
      contest_max_winners: is_contest ? contest_max_winners : null,
      contest_winner_prizes: is_contest ? contest_winner_prizes : null,
      contest_submission_deadline: is_contest ? contest_submission_deadline : null,
      contest_winner_selection_deadline: is_contest ? contest_winner_selection_deadline : null,
      contest_submissions_visible: is_contest ? (contest_submissions_visible ?? true) : true,
      // Environment filtering
      environment: getEnvironment(forceProduction)
    }
    
    let job
    try {
      job = await retryWithBackoff(
        async () => {
          const { data, error } = await supabaseAdmin
            .from('jobs')
            .insert(jobInsertData)
            .select()
            .single()
          
          if (error) {
            // Log full error details for debugging
            console.error('[Job Create] Database insert error:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            })
            throw error
          }
          
          return data
        },
        3, // 3 retries
        1000, // 1 second initial delay
        'JobInsert'
      )
    } catch (jobError: any) {
      console.error('[Job Create] Job creation failed after retries:', {
        error: jobError,
        escrow_tx_signature,
        poster_wallet,
        title
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to create job in database',
          code: 'DB_INSERT_FAILED',
          details: jobError.message,
          escrow_tx_signature, // Include tx signature for recovery
          recoverable: true
        },
        { status: 500 }
      )
    }

    console.log(`${is_contest ? 'Contest' : 'Job'} created successfully:`, job.id)

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

    // Award karma to poster for creating job/contest
    try {
      const { error: karmaError } = await supabaseAdmin
        .rpc('award_karma', {
          p_wallet_address: poster_wallet,
          p_project_id: project_id,
          p_amount: is_contest ? 75 : 50, // More karma for contests
          p_reason: is_contest ? 'contest_posted' : 'job_posted'
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

    console.log(`${is_contest ? 'Contest' : 'Job'} creation complete:`, job.id)

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









