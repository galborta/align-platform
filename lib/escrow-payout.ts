import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { WalletContextState } from '@solana/wallet-adapter-react'
import { supabase } from './supabase'
import { notificationService } from './services/notificationService'

/**
 * Winner information for contest payout
 */
interface Winner {
  wallet: string
  amount_tokens: number
  position: number
  submission_id: string
}

/**
 * Result of a payout operation
 */
interface PayoutResult {
  success: boolean
  signature?: string
  error?: string
}

/**
 * Execute contest payout to multiple winners
 * 
 * This function transfers prize tokens from escrow to all contest winners
 * in a single transaction batch, updates the database, and sends notifications.
 * 
 * @param connection - Solana RPC connection
 * @param wallet - Connected wallet context
 * @param jobId - UUID of the contest job
 * @param winners - Array of winner details (wallet, amount, position, submission_id)
 * @param escrowWallet - Public key of the escrow wallet
 * @param tokenDecimals - Token decimal places (default 9 for SOL)
 * @returns PayoutResult with success status and transaction signature
 * 
 * @example
 * ```typescript
 * const result = await executeContestPayout(
 *   connection,
 *   wallet,
 *   jobId,
 *   [
 *     { wallet: '5yG3...', amount_tokens: 100, position: 1, submission_id: 'abc-123' },
 *     { wallet: '8kL2...', amount_tokens: 50, position: 2, submission_id: 'def-456' }
 *   ],
 *   new PublicKey(escrowAddress),
 *   9
 * )
 * ```
 */
export async function executeContestPayout(
  connection: Connection,
  wallet: WalletContextState,
  jobId: string,
  winners: Winner[],
  escrowWallet: PublicKey,
  tokenDecimals: number = 9
): Promise<PayoutResult> {
  try {
    // ==================== WALLET VALIDATION ====================
    
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected')
    }

    console.log(`[Contest Payout] Starting payout for job ${jobId}`)
    console.log(`[Contest Payout] Number of winners: ${winners.length}`)

    // ==================== FETCH AND VALIDATE JOB ====================
    
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Job not found')
    }

    console.log(`[Contest Payout] Job found: ${job.title}`)
    console.log(`[Contest Payout] Is contest: ${job.is_contest}`)
    console.log(`[Contest Payout] Escrow locked: ${job.escrow_locked}`)
    console.log(`[Contest Payout] Status: ${job.status}`)

    // Verify this is a contest
    if (!job.is_contest) {
      throw new Error('This is not a contest job')
    }

    // Verify escrow is locked
    if (!job.escrow_locked) {
      throw new Error('Escrow not locked for this job')
    }

    // Verify job is not already completed
    if (job.status === 'completed') {
      throw new Error('Contest already paid out')
    }

    // Verify winners have been selected
    if (!job.contest_winners_selected_at) {
      throw new Error('Winners have not been selected yet')
    }

    // Verify caller is the job poster
    if (job.poster_wallet !== wallet.publicKey.toString()) {
      throw new Error('Only job poster can execute payout')
    }

    // Verify winner count matches expected
    if (winners.length !== job.contest_max_winners) {
      throw new Error(`Expected ${job.contest_max_winners} winners, got ${winners.length}`)
    }

    // Calculate total payout
    const totalPayout = winners.reduce((sum, w) => sum + w.amount_tokens, 0)
    console.log(`[Contest Payout] Total payout: ${totalPayout} tokens`)

    // Verify total payout matches escrow amount (minus platform fee)
    const feePercentage = job.fee_percentage_at_creation || 5
    const expectedPayout = job.escrow_amount_tokens! * (1 - feePercentage / 100)
    
    // Allow small tolerance for floating point
    if (Math.abs(totalPayout - expectedPayout) > 0.01) {
      console.warn(`[Contest Payout] Payout mismatch: expected ${expectedPayout}, got ${totalPayout}`)
    }

    // ==================== BUILD TRANSACTION ====================
    
    console.log(`[Contest Payout] Building transaction...`)
    const transaction = new Transaction()

    // Add transfer instruction for each winner
    for (const winner of winners) {
      const winnerPubkey = new PublicKey(winner.wallet)
      const amountLamports = Math.floor(winner.amount_tokens * Math.pow(10, tokenDecimals))

      console.log(`[Contest Payout] Adding transfer: ${winner.amount_tokens} tokens to ${winner.wallet.slice(0, 8)}... (position ${winner.position})`)

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: escrowWallet,
          toPubkey: winnerPubkey,
          lamports: amountLamports
        })
      )
    }

    // ==================== SIGN AND SEND TRANSACTION ====================
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet.publicKey

    console.log(`[Contest Payout] Signing transaction...`)
    const signedTransaction = await wallet.signTransaction(transaction)
    
    console.log(`[Contest Payout] Sending transaction...`)
    const signature = await connection.sendRawTransaction(signedTransaction.serialize())
    console.log(`[Contest Payout] Transaction sent: ${signature}`)

    // Confirm transaction
    console.log(`[Contest Payout] Confirming transaction...`)
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed')

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
    }

    console.log(`[Contest Payout] ✅ Transaction confirmed`)

    // ==================== UPDATE DATABASE ====================
    
    console.log(`[Contest Payout] Updating database...`)

    // Update job status to completed
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        escrow_locked: false,
        escrow_tx_signature: signature,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('[Contest Payout] Failed to update job:', jobUpdateError)
      // CRITICAL: Transaction succeeded but DB update failed
      // Log for manual intervention
      console.error('[Contest Payout] ⚠️ CRITICAL: Payment released but DB update failed')
      console.error('[Contest Payout] Job ID:', jobId)
      console.error('[Contest Payout] Transaction:', signature)
    } else {
      console.log(`[Contest Payout] ✅ Job marked as completed`)
    }

    // ==================== SEND NOTIFICATIONS ====================
    
    console.log(`[Contest Payout] Sending notifications to winners...`)

    const notificationPromises = winners.map(winner => 
      notificationService.createNotification({
        userWallet: winner.wallet,
        type: 'payment_released',
        actorWallet: job.poster_wallet,
        referenceId: jobId,
        referenceType: 'job',
        metadata: {
          job_title: job.title,
          amount: winner.amount_tokens,
          token: 'tokens', // Token symbol resolved from escrow_token_mint if needed
          winner_position: winner.position
        }
      })
    )

    try {
      await Promise.all(notificationPromises)
      console.log(`[Contest Payout] ✅ Notifications sent to ${winners.length} winners`)
    } catch (notifError) {
      console.error('[Contest Payout] Failed to send some notifications:', notifError)
      // Non-critical - payment already released
    }

    // ==================== RECORD TRANSACTIONS ====================
    
    console.log(`[Contest Payout] Recording transactions for audit...`)

    // Determine token symbol from mint (SOL if native mint or null)
    const tokenSymbol = !job.escrow_token_mint || 
      job.escrow_token_mint === 'So11111111111111111111111111111111111111112' 
        ? 'SOL' 
        : 'TOKEN'

    const transactionPromises = winners.map(winner =>
      supabase.from('job_escrow_transactions').insert({
        job_id: jobId,
        transaction_type: 'partial_release', // Contest winners receive partial releases from escrow
        from_wallet: escrowWallet.toString(),
        to_wallet: winner.wallet,
        amount_tokens: winner.amount_tokens,
        token_mint: job.escrow_token_mint || 'So11111111111111111111111111111111111111112',
        token_symbol: tokenSymbol,
        tx_signature: signature,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
    )

    try {
      await Promise.all(transactionPromises)
      console.log(`[Contest Payout] ✅ Transaction records created`)
    } catch (txError) {
      console.error('[Contest Payout] Failed to record some transactions:', txError)
      // Non-critical - payment already released
    }

    // ==================== AWARD KARMA TO CONTEST WINNERS ====================
    
    console.log(`[Contest Payout] Awarding karma to winners based on position...`)

    // Award karma using the RPC function based on winner position
    // 1st place: +100 karma, 2nd: +75, 3rd: +50, 4th+: +25
    const karmaPromises = winners.map(winner => {
      const karmaAmount = winner.position === 1 ? 100 :
                          winner.position === 2 ? 75 :
                          winner.position === 3 ? 50 : 25
      
      console.log(`[Contest Payout] Awarding ${karmaAmount} karma to position ${winner.position}: ${winner.wallet.slice(0, 8)}...`)
      
      return supabase.rpc('award_contest_winner_karma', {
        p_wallet: winner.wallet,
        p_project: job.project_id,
        p_position: winner.position
      })
    })

    try {
      const results = await Promise.all(karmaPromises)
      
      // Check for any errors in the results
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        console.error('[Contest Payout] Some karma awards failed:', errors.map(e => e.error))
      }
      
      console.log(`[Contest Payout] ✅ Karma awarded to ${winners.length - errors.length}/${winners.length} winners`)
    } catch (karmaError) {
      console.error('[Contest Payout] Failed to award karma:', karmaError)
      // Non-critical - payment already released
    }

    console.log(`[Contest Payout] ✅ Contest payout complete`)

    return {
      success: true,
      signature
    }

  } catch (error: any) {
    console.error('[Contest Payout] ❌ Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to execute payout'
    }
  }
}

/**
 * Estimate transaction fees for contest payout
 * 
 * @param numWinners - Number of winners to pay
 * @returns Estimated fee in SOL
 */
export function estimatePayoutFees(numWinners: number): number {
  // Base transaction fee ~0.000005 SOL
  // Each transfer instruction adds minimal additional cost
  // Account for priority fees during congestion
  const baseFee = 0.000005
  const perTransferFee = 0.000001
  const priorityBuffer = 1.5 // 50% buffer for priority fees
  
  return (baseFee + (perTransferFee * numWinners)) * priorityBuffer
}

/**
 * Verify escrow wallet has sufficient balance for payout
 * 
 * @param connection - Solana RPC connection
 * @param escrowWallet - Public key of escrow wallet
 * @param requiredAmount - Required amount in tokens
 * @param tokenDecimals - Token decimal places
 * @returns Object with balance status and actual balance
 */
export async function verifyEscrowBalance(
  connection: Connection,
  escrowWallet: PublicKey,
  requiredAmount: number,
  tokenDecimals: number = 9
): Promise<{ sufficient: boolean; actualBalance: number }> {
  try {
    console.log(`[Escrow Balance] Checking balance for ${escrowWallet.toString()}`)
    console.log(`[Escrow Balance] Required: ${requiredAmount} tokens`)

    const balance = await connection.getBalance(escrowWallet)
    const balanceInTokens = balance / Math.pow(10, tokenDecimals)
    
    console.log(`[Escrow Balance] Actual: ${balanceInTokens} tokens`)
    
    const sufficient = balanceInTokens >= requiredAmount
    console.log(`[Escrow Balance] Sufficient: ${sufficient}`)

    return {
      sufficient,
      actualBalance: balanceInTokens
    }
  } catch (error) {
    console.error('[Escrow Balance] ❌ Error checking balance:', error)
    return {
      sufficient: false,
      actualBalance: 0
    }
  }
}

/**
 * Get winners from job submissions
 * 
 * @param jobId - UUID of the job
 * @returns Array of winners sorted by position
 */
export async function getContestWinners(jobId: string): Promise<Winner[]> {
  const { data: submissions, error } = await supabase
    .from('job_submissions')
    .select('*')
    .eq('job_id', jobId)
    .eq('is_selected_winner', true)
    .order('winner_position', { ascending: true })

  if (error) {
    console.error('[Get Winners] Error fetching winners:', error)
    throw new Error('Failed to fetch contest winners')
  }

  if (!submissions || submissions.length === 0) {
    throw new Error('No winners found for this contest')
  }

  return submissions.map(s => ({
    wallet: s.worker_wallet,
    amount_tokens: s.prize_amount_tokens || 0,
    position: s.winner_position || 0,
    submission_id: s.id
  }))
}

/**
 * Validate contest is ready for payout
 * 
 * @param jobId - UUID of the job
 * @returns Validation result with any error message
 */
export async function validateContestReadyForPayout(
  jobId: string
): Promise<{ valid: boolean; error?: string }> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return { valid: false, error: 'Job not found' }
  }

  if (!job.is_contest) {
    return { valid: false, error: 'This is not a contest job' }
  }

  if (!job.escrow_locked) {
    return { valid: false, error: 'Escrow not locked' }
  }

  if (job.status === 'completed') {
    return { valid: false, error: 'Contest already completed' }
  }

  if (!job.contest_winners_selected_at) {
    return { valid: false, error: 'Winners have not been selected' }
  }

  // Verify all winner positions are filled
  const { data: winners, error: winnersError } = await supabase
    .from('job_submissions')
    .select('winner_position')
    .eq('job_id', jobId)
    .eq('is_selected_winner', true)

  if (winnersError) {
    return { valid: false, error: 'Failed to fetch winners' }
  }

  if (!winners || winners.length !== job.contest_max_winners) {
    return { 
      valid: false, 
      error: `Expected ${job.contest_max_winners} winners, found ${winners?.length || 0}` 
    }
  }

  return { valid: true }
}

