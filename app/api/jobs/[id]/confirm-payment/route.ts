import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection } from '@solana/web3.js'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Solana connection
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(SOLANA_RPC, 'confirmed')

/**
 * POST /api/jobs/[id]/confirm-payment
 * 
 * Confirms that a payment transaction was successfully sent on-chain
 * and updates all database records accordingly.
 * 
 * This endpoint is useful for:
 * 1. Verifying transactions that were sent client-side
 * 2. Re-confirming if initial database updates failed
 * 3. Manual verification of payment status
 * 
 * Request body:
 * - transaction_signature: string (required) - Solana tx signature
 * - transaction_record_id?: string - Payment transaction record ID
 * 
 * Flow:
 * 1. Verifies transaction exists and succeeded on Solana
 * 2. Updates payment_transactions record status
 * 3. Marks all submissions as paid
 * 4. Awards karma to workers
 * 5. Sends payment notifications
 * 6. Updates poster karma
 * 7. Releases escrow lock
 * 
 * @param request - Request with transaction details
 * @param params - URL params containing job id
 * @returns Success response with workers paid count or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    // Await params in Next.js 15+
    const { id: jobId } = await params
    console.log(`[Confirm Payment] Starting for job ${jobId}`)

    // Parse request body
    const body = await request.json()
    const { transaction_signature, transaction_record_id } = body

    // ==================== VALIDATION ====================

    if (!transaction_signature) {
      return NextResponse.json(
        { error: 'Transaction signature required' },
        { status: 400 }
      )
    }

    console.log(`[Confirm Payment] Verifying transaction: ${transaction_signature}`)

    // ==================== VERIFY TRANSACTION ON-CHAIN ====================

    let txConfirmed = false
    let txDetails = null

    try {
      txDetails = await connection.getTransaction(transaction_signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })
      
      // Transaction exists and has no errors
      txConfirmed = txDetails !== null && !txDetails.meta?.err
      
      if (txDetails?.meta?.err) {
        console.error('[Confirm Payment] Transaction has errors:', txDetails.meta.err)
      }
    } catch (error) {
      console.error('[Confirm Payment] Error verifying transaction:', error)
    }

    if (!txConfirmed) {
      console.error('[Confirm Payment] Transaction not confirmed on-chain')
      
      // Update payment transaction record as failed if we have the ID
      if (transaction_record_id) {
        await supabaseAdmin
          .from('payment_transactions')
          .update({
            status: 'failed',
            error_message: 'Transaction not found or failed on blockchain',
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction_record_id)
      }

      return NextResponse.json(
        { error: 'Transaction not found or failed on blockchain' },
        { status: 400 }
      )
    }

    console.log(`[Confirm Payment] ✅ Transaction verified on-chain`)

    // ==================== UPDATE PAYMENT TRANSACTION RECORD ====================

    if (transaction_record_id) {
      const { error: txUpdateError } = await supabaseAdmin
        .from('payment_transactions')
        .update({
          status: 'confirmed',
          transaction_signature: transaction_signature,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction_record_id)

      if (txUpdateError) {
        console.error('[Confirm Payment] Failed to update payment transaction:', txUpdateError)
        // Continue - this is not critical
      } else {
        console.log(`[Confirm Payment] ✅ Payment transaction record updated`)
      }
    }

    // ==================== GET JOB DETAILS ====================

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Confirm Payment] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== GET APPROVED SUBMISSIONS ====================

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('job_submissions')
      .select('id, worker_wallet, social_payment_amount_tokens, social_payment_amount_usd')
      .eq('job_id', jobId)
      .in('social_approval_status', ['approved', 'auto_approved'])

    if (submissionsError) {
      console.error('[Confirm Payment] Failed to fetch submissions:', submissionsError)
      throw new Error('Failed to fetch submissions')
    }

    console.log(`[Confirm Payment] Found ${submissions?.length || 0} approved submissions`)

    // ==================== UPDATE SUBMISSIONS ====================

    if (submissions && submissions.length > 0) {
      console.log(`[Confirm Payment] Marking ${submissions.length} submissions as paid...`)

      for (const submission of submissions) {
        // Update submission payment status
        const { error: subUpdateError } = await supabaseAdmin
          .from('job_submissions')
          .update({
            social_payment_released: true,
            social_payment_tx_signature: transaction_signature
          })
          .eq('id', submission.id)

        if (subUpdateError) {
          console.error(`[Confirm Payment] Failed to update submission ${submission.id}:`, subUpdateError)
          // Continue with other submissions
        }

        // ==================== AWARD WORKER KARMA ====================

        // Increment jobs completed count
        try {
          await supabaseAdmin.rpc('increment_karma_field', {
            wallet_address: submission.worker_wallet,
            field_name: 'jobs_completed_as_worker_count'
          })
        } catch (karmaError) {
          console.error(`[Confirm Payment] Failed to increment jobs_completed for ${submission.worker_wallet}:`, karmaError)
        }

        // Increment tokens earned (by amount)
        if (submission.social_payment_amount_tokens) {
          try {
            await supabaseAdmin.rpc('increment_karma_field_by_amount', {
              p_wallet_address: submission.worker_wallet,
              p_field_name: 'tokens_earned',
              p_amount: submission.social_payment_amount_tokens
            })
          } catch (karmaError) {
            console.error(`[Confirm Payment] Failed to increment tokens_earned for ${submission.worker_wallet}:`, karmaError)
            // Fallback: try adding to total_karma_points as a number
          }
        }

        // ==================== NOTIFY WORKER ====================

        try {
          await notificationService.createNotification({
            userWallet: submission.worker_wallet,
            type: 'payment_released',
            actorWallet: job.poster_wallet,
            referenceId: jobId,
            referenceType: 'payment',
            metadata: {
              job_id: jobId,
              job_title: job.title,
              amount_tokens: submission.social_payment_amount_tokens,
              amount_usd: submission.social_payment_amount_usd,
              tx_signature: transaction_signature,
              is_social_media_job: true
            }
          })
        } catch (notifError) {
          console.error(`[Confirm Payment] Failed to notify worker ${submission.worker_wallet}:`, notifError)
          // Non-critical, continue
        }
      }

      console.log(`[Confirm Payment] ✅ Updated ${submissions.length} submissions`)
    }

    // ==================== UPDATE POSTER KARMA ====================

    try {
      // Increment poster's jobs completed count
      await supabaseAdmin.rpc('increment_karma_field', {
        wallet_address: job.poster_wallet,
        field_name: 'jobs_posted_as_poster_count'
      })
      console.log(`[Confirm Payment] ✅ Poster karma updated`)
    } catch (karmaError) {
      console.error('[Confirm Payment] Failed to update poster karma:', karmaError)
      // Non-critical, continue
    }

    // ==================== RELEASE ESCROW ====================

    const { error: escrowUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        escrow_locked: false,
        status: 'completed',
        completed_at: new Date().toISOString(),
        social_payments_distributed: true,
        social_payment_tx_signature: transaction_signature,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (escrowUpdateError) {
      console.error('[Confirm Payment] Failed to update job escrow status:', escrowUpdateError)
      // This is concerning but payment was confirmed
    } else {
      console.log(`[Confirm Payment] ✅ Escrow released, job marked completed`)
    }

    // ==================== SUCCESS RESPONSE ====================

    const duration = Date.now() - startTime
    console.log(`[Confirm Payment] ✅ Complete in ${duration}ms`)

    return NextResponse.json({
      success: true,
      transaction_signature,
      workers_paid: submissions?.length || 0,
      job_status: 'completed',
      escrow_released: true
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Confirm Payment] ❌ Error after ${duration}ms:`, error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

