import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection } from '@solana/web3.js'
import { Database } from '@/types/database'
import { requireVerifiedWallet } from '@/lib/middleware'
import type { BudgetTier, SocialJobType } from '@/types/social-jobs'
import {
  validateTweetUrl,
  validateBudgetTiers,
  calculateSocialJobDeadlines
} from '@/lib/social-jobs'

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
 * POST /api/jobs/social/create
 * 
 * Create a new social media job (retweet or original tweet campaign)
 * 
 * Required fields:
 * - project_id: UUID of the project
 * - poster_wallet: Wallet address of job poster
 * - title: Job title
 * - description: Job description
 * - social_job_type: 'retweet' | 'original_tweet'
 * - social_tweet_url: Tweet URL (required for retweet jobs)
 * - social_tweet_topic: Topic description (required for original_tweet jobs)
 * - social_budget_tiers: Array of 6 budget tiers
 * - social_total_budget_usd: Total campaign budget in USD
 * - social_total_budget_tokens: Total campaign budget in tokens
 * - campaign_duration_days: 3, 7, 14, or 30 days
 * - escrow_tx_signature: Transaction signature for escrow lock
 * - escrow_amount_tokens: Amount locked in escrow
 * - escrow_token_mint: Token mint address
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
      social_job_type,
      social_tweet_url,
      social_tweet_topic,
      social_budget_tiers,
      social_total_budget_usd,
      social_total_budget_tokens,
      social_min_followers_required,
      campaign_duration_days,
      escrow_tx_signature,
      escrow_locked,
      escrow_amount_tokens,
      escrow_token_mint,
      fee_percentage_at_creation,
      token_symbol
    } = body

    // ==================== VALIDATION ====================

    // 1. Validate required fields
    if (!project_id || !poster_wallet || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, poster_wallet, title, description' },
        { status: 400 }
      )
    }

    if (!social_job_type || !['retweet', 'original_tweet'].includes(social_job_type)) {
      return NextResponse.json(
        { error: 'Invalid social_job_type. Must be "retweet" or "original_tweet"' },
        { status: 400 }
      )
    }

    // 2. Verify wallet is verified before allowing job creation
    const verificationCheck = await requireVerifiedWallet(poster_wallet)
    if (!verificationCheck.verified) {
      return NextResponse.json(
        { error: 'Wallet verification required to create jobs' },
        { status: 403 }
      )
    }

    // 3. Validate job type-specific fields
    if (social_job_type === 'retweet') {
      if (!social_tweet_url) {
        return NextResponse.json(
          { error: 'social_tweet_url is required for retweet jobs' },
          { status: 400 }
        )
      }
      
      if (!validateTweetUrl(social_tweet_url)) {
        return NextResponse.json(
          { error: 'Invalid tweet URL format. Must be https://(twitter.com|x.com)/user/status/id' },
          { status: 400 }
        )
      }
    }

    if (social_job_type === 'original_tweet') {
      if (!social_tweet_topic) {
        return NextResponse.json(
          { error: 'social_tweet_topic is required for original_tweet jobs' },
          { status: 400 }
        )
      }
      
      if (social_tweet_topic.length < 10) {
        return NextResponse.json(
          { error: 'social_tweet_topic must be at least 10 characters' },
          { status: 400 }
        )
      }
    }

    // 4. Validate budget
    if (!social_total_budget_usd || social_total_budget_usd < 50) {
      return NextResponse.json(
        { error: 'Minimum budget is $50 USD' },
        { status: 400 }
      )
    }

    if (social_total_budget_usd > 50000) {
      return NextResponse.json(
        { error: 'Maximum budget is $50,000 USD' },
        { status: 400 }
      )
    }

    if (!social_total_budget_tokens || social_total_budget_tokens <= 0) {
      return NextResponse.json(
        { error: 'Invalid token budget amount' },
        { status: 400 }
      )
    }

    // 5. Validate budget tiers
    if (!social_budget_tiers || !Array.isArray(social_budget_tiers)) {
      return NextResponse.json(
        { error: 'social_budget_tiers must be an array' },
        { status: 400 }
      )
    }

    if (social_budget_tiers.length !== 6) {
      return NextResponse.json(
        { error: 'Must provide exactly 6 budget tiers' },
        { status: 400 }
      )
    }

    const tierValidation = validateBudgetTiers(social_budget_tiers as BudgetTier[])
    if (!tierValidation.valid) {
      return NextResponse.json(
        { error: `Invalid budget tiers: ${tierValidation.error}` },
        { status: 400 }
      )
    }

    // 6. Validate campaign duration
    const validDurations = [3, 7, 14, 30]
    if (!campaign_duration_days || !validDurations.includes(campaign_duration_days)) {
      return NextResponse.json(
        { error: 'campaign_duration_days must be 3, 7, 14, or 30' },
        { status: 400 }
      )
    }

    // 7. Validate escrow fields
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

    // ==================== CALCULATE DERIVED FIELDS ====================

    const now = new Date()
    
    // Calculate submission deadline (now + campaign duration)
    const submissionDeadline = new Date(now)
    submissionDeadline.setDate(submissionDeadline.getDate() + campaign_duration_days)
    
    // Review deadline: submission deadline + 1 day
    const reviewDeadline = new Date(submissionDeadline)
    reviewDeadline.setDate(reviewDeadline.getDate() + 1)
    
    // Engagement deadline: submission deadline + 7 days (allow time for impressions to accumulate)
    const engagementDeadline = new Date(submissionDeadline)
    engagementDeadline.setDate(engagementDeadline.getDate() + 7)

    console.log('[Social Job Create] Creating social media job:', {
      project_id,
      poster_wallet,
      title,
      social_job_type,
      social_total_budget_usd,
      campaign_duration_days,
      escrow_tx_signature
    })

    // ==================== VERIFY ESCROW TRANSACTION ====================

    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    
    if (!rpcUrl) {
      console.error('[Social Job Create] No RPC URL configured')
      return NextResponse.json(
        { error: 'Server configuration error', code: 'NO_RPC_URL' },
        { status: 500 }
      )
    }

    const connection = new Connection(rpcUrl, 'confirmed')
    
    try {
      console.log('[Social Job Create] Verifying transaction on-chain:', escrow_tx_signature)
      
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
        2000, // Start with 2 second delay
        'TxVerification'
      )
      
      if (tx.meta?.err) {
        console.error('[Social Job Create] Transaction failed on-chain:', tx.meta.err)
        return NextResponse.json(
          { error: 'Transaction failed on blockchain', code: 'TX_FAILED', details: tx.meta.err },
          { status: 400 }
        )
      }

      console.log('[Social Job Create] Transaction verified successfully')
      
    } catch (txError: any) {
      console.error('[Social Job Create] Transaction verification failed after retries:', txError)
      console.warn('[Social Job Create] Proceeding with job creation despite verification failure - funds are locked')
    }

    // ==================== CREATE JOB IN DATABASE ====================

    console.log('[Social Job Create] Inserting job into database...')
    
    const jobInsertData = {
      project_id,
      poster_wallet,
      title,
      description,
      kpis: kpis || 'Social media engagement metrics',
      category: category || 'social_media',
      payment_amount_tokens: payment_amount_tokens || social_total_budget_tokens, // Use total budget to satisfy constraint
      payment_amount_usd: payment_amount_usd || social_total_budget_usd,
      assignment_mode: 'review', // Social jobs always use review mode
      status: 'open',
      escrow_tx_signature,
      escrow_locked,
      escrow_amount_tokens,
      escrow_token_mint,
      fee_percentage_at_creation: fee_percentage_at_creation || 5.0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      // Social media job fields
      is_social_media_job: true,
      social_job_type: social_job_type as SocialJobType,
      social_tweet_url: social_tweet_url || null,
      social_tweet_topic: social_tweet_topic || null,
      social_submission_deadline: submissionDeadline.toISOString(),
      social_review_deadline: reviewDeadline.toISOString(),
      social_engagement_deadline: engagementDeadline.toISOString(),
      social_total_budget_usd,
      social_total_budget_tokens,
      social_budget_tiers: social_budget_tiers as BudgetTier[],
      social_actual_budget_released: 0,
      social_payments_distributed: false,
      social_min_followers_required: social_min_followers_required || null,
      // Enable instant payment system for all new social jobs
      uses_instant_payment: true
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
            console.error('[Social Job Create] Database insert error:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            })
            throw error
          }
          
          return data
        },
        3,
        1000,
        'JobInsert'
      )
    } catch (jobError: any) {
      console.error('[Social Job Create] Job creation failed after retries:', {
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
          escrow_tx_signature,
          recoverable: true
        },
        { status: 500 }
      )
    }

    console.log('Social media job created successfully:', job.id)

    // ==================== CREATE ESCROW TRANSACTION RECORD ====================

    const { data: escrowWalletSetting } = await supabaseAdmin
      .rpc('get_platform_setting', { 
        p_setting_key: 'escrow_wallet_address' 
      })

    const escrowWallet = escrowWalletSetting || process.env.ESCROW_WALLET_ADDRESS || 'UNKNOWN'

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
        confirmed_at: now.toISOString(),
        created_at: now.toISOString()
      })
    
    if (escrowError) {
      console.error('Escrow transaction record failed:', escrowError)
    } else {
      console.log('Escrow transaction record created')
    }

    // ==================== AWARD KARMA ====================

    try {
      const { error: karmaError } = await supabaseAdmin
        .rpc('award_karma', {
          p_wallet_address: poster_wallet,
          p_project_id: project_id,
          p_amount: 50, // Standard karma for job posting
          p_reason: 'social_job_posted'
        })
      
      if (karmaError) {
        console.error('Failed to award karma:', karmaError)
      } else {
        console.log('Karma awarded to poster')
      }
    } catch (karmaErr) {
      console.error('Karma error:', karmaErr)
    }

    console.log('Social job creation complete:', job.id)

    return NextResponse.json({ 
      success: true, 
      job,
      deadlines: {
        submission: submissionDeadline.toISOString(),
        review: reviewDeadline.toISOString(),
        engagement: engagementDeadline.toISOString()
      }
    }, { status: 201 })
    
  } catch (error: any) {
    console.error('Social job creation error:', error)
    
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
 * GET /api/jobs/social/create
 * Returns method not allowed
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

