import {
  Connection,
  PublicKey,
  Transaction,
  Keypair
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { getFeeWallet, getFeePercentage } from '../platform-settings'
import { supabase } from '../supabase'
import bs58 from 'bs58'

/**
 * Parameters for releasing payment from escrow
 */
export interface ReleasePaymentParams {
  /** Solana connection instance */
  connection: Connection
  /** UUID of the job being completed */
  jobId: string
  /** Worker's wallet address (recipient of 95% payment) */
  workerWallet: string
  /** Token mint address (SPL token or native SOL) */
  tokenMint: string
  /** Total amount locked in escrow (payment + fee) */
  escrowAmount: number
  /** Token decimal places (e.g., 9 for SOL, 6 for USDC) */
  decimals: number
  /** Platform fee percentage (e.g., 5.0 for 5%) */
  feePercentage: number
}

/**
 * Result of payment release operation
 */
export interface ReleasePaymentResult {
  /** Whether the release was successful */
  success: boolean
  /** Transaction signature for worker payment */
  workerTxSignature?: string
  /** Transaction signature for fee collection */
  feeTxSignature?: string
  /** Actual amount received by worker (in tokens, not raw units) */
  workerReceived: number
  /** Actual fee collected by platform (in tokens, not raw units) */
  feeCollected: number
  /** Error message if operation failed */
  error?: string
}

/**
 * Interface for tracking retryable release attempts
 */
export interface RetryableRelease {
  /** UUID of the job being released */
  jobId: string
  /** Current attempt number (1-indexed) */
  attemptNumber: number
  /** Error message from last failed attempt */
  lastError?: string
}

/**
 * Release payment from escrow to worker and platform fee wallet
 * 
 * This function performs a two-step atomic release:
 * 1. Transfers (100% - fee%) to the worker's token account
 * 2. Transfers fee% to the platform fee wallet
 * 
 * The escrow wallet's private key must be available in environment variables
 * as ESCROW_WALLET_PRIVATE_KEY (base58 encoded).
 * 
 * **Security Requirements:**
 * - ESCROW_WALLET_PRIVATE_KEY must be stored in secure environment variables
 * - Never commit private keys to version control
 * - Use Vercel secrets or similar for production deployment
 * - Consider hardware wallet integration for mainnet escrow
 * 
 * **Transaction Flow:**
 * 1. Validates escrow wallet private key exists
 * 2. Calculates worker amount (escrowAmount - fee) and fee amount
 * 3. Creates Associated Token Accounts if they don't exist
 * 4. Transfers worker payment (with confirmation)
 * 5. Transfers platform fee (with confirmation)
 * 6. Returns both transaction signatures and amounts
 * 
 * **Error Handling:**
 * - Returns { success: false, error: string } on any failure
 * - Logs detailed error information to console
 * - Does not throw exceptions (safe for cron jobs)
 * 
 * @param params - Release payment parameters
 * @returns Result object with signatures and amounts or error
 * 
 * @example
 * ```typescript
 * const result = await releasePaymentFromEscrow({
 *   connection: new Connection(rpcUrl),
 *   jobId: job.id,
 *   workerWallet: job.assigned_to,
 *   tokenMint: job.escrow_token_mint,
 *   escrowAmount: job.escrow_amount_tokens,
 *   decimals: 9, // SOL
 *   feePercentage: 5.0
 * })
 * 
 * if (result.success) {
 *   console.log('Released:', result.workerReceived, 'to worker')
 *   console.log('Fee collected:', result.feeCollected)
 *   console.log('Worker tx:', result.workerTxSignature)
 *   console.log('Fee tx:', result.feeTxSignature)
 * } else {
 *   console.error('Release failed:', result.error)
 * }
 * ```
 */
export async function releasePaymentFromEscrow(
  params: ReleasePaymentParams
): Promise<ReleasePaymentResult> {
  const startTime = Date.now()
  
  try {
    const {
      connection,
      jobId,
      workerWallet,
      tokenMint,
      escrowAmount,
      decimals,
      feePercentage
    } = params

    console.log(`[Escrow Release] Starting for job ${jobId}`)
    console.log(`[Escrow Release] Total escrow: ${escrowAmount}, Fee: ${feePercentage}%`)
    
    // Validate environment configuration
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      const error = 'ESCROW_WALLET_PRIVATE_KEY not configured in environment'
      console.error(`[Escrow Release] ${error}`)
      throw new Error(error)
    }

    // Decode escrow wallet keypair
    let escrowKeypair: Keypair
    try {
      escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
      console.log(`[Escrow Release] Escrow wallet: ${escrowKeypair.publicKey.toString()}`)
    } catch (error) {
      const message = 'Invalid escrow private key format (must be base58 encoded)'
      console.error(`[Escrow Release] ${message}`, error)
      throw new Error(message)
    }

    const escrowWallet = escrowKeypair.publicKey
    
    // Fetch fee wallet from platform settings
    const feeWalletAddress = await getFeeWallet()
    if (!feeWalletAddress) {
      throw new Error('Fee wallet not configured in platform settings')
    }
    const feeWallet = new PublicKey(feeWalletAddress)
    console.log(`[Escrow Release] Fee wallet: ${feeWallet.toString()}`)
    
    // Calculate amounts
    const feeAmount = escrowAmount * (feePercentage / 100)
    const workerAmount = escrowAmount - feeAmount
    
    console.log(`[Escrow Release] Worker amount: ${workerAmount}`)
    console.log(`[Escrow Release] Fee amount: ${feeAmount}`)
    
    // Create public keys
    const tokenMintPubkey = new PublicKey(tokenMint)
    const workerPubkey = new PublicKey(workerWallet)
    
    // Get Associated Token Addresses
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      escrowWallet
    )
    
    const workerTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      workerPubkey
    )
    
    const feeTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      feeWallet
    )

    console.log(`[Escrow Release] Escrow ATA: ${escrowTokenAccount.toString()}`)
    console.log(`[Escrow Release] Worker ATA: ${workerTokenAccount.toString()}`)
    console.log(`[Escrow Release] Fee ATA: ${feeTokenAccount.toString()}`)
    
    // Check if token accounts exist
    const [workerAccountInfo, feeAccountInfo] = await Promise.all([
      connection.getAccountInfo(workerTokenAccount),
      connection.getAccountInfo(feeTokenAccount)
    ])

    console.log(`[Escrow Release] Worker ATA exists: ${!!workerAccountInfo}`)
    console.log(`[Escrow Release] Fee ATA exists: ${!!feeAccountInfo}`)
    
    // ==================== TRANSACTION 1: Transfer to Worker ====================
    
    console.log(`[Escrow Release] Building worker transaction...`)
    const workerTx = new Transaction()
    
    // Create worker ATA if needed
    if (!workerAccountInfo) {
      console.log(`[Escrow Release] Adding instruction to create worker ATA`)
      workerTx.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet, // payer (escrow pays rent)
          workerTokenAccount,
          workerPubkey,
          tokenMintPubkey
        )
      )
    }
    
    // Transfer to worker
    const workerAmountRaw = Math.floor(workerAmount * Math.pow(10, decimals))
    console.log(`[Escrow Release] Worker amount (raw): ${workerAmountRaw}`)
    
    workerTx.add(
      createTransferInstruction(
        escrowTokenAccount,
        workerTokenAccount,
        escrowWallet,
        workerAmountRaw
      )
    )
    
    // Set transaction metadata
    const { blockhash: workerBlockhash } = await connection.getLatestBlockhash('confirmed')
    workerTx.recentBlockhash = workerBlockhash
    workerTx.feePayer = escrowWallet
    
    // Sign and send worker transaction
    console.log(`[Escrow Release] Signing worker transaction...`)
    workerTx.sign(escrowKeypair)
    
    console.log(`[Escrow Release] Sending worker transaction...`)
    const workerTxSignature = await connection.sendRawTransaction(
      workerTx.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    )
    console.log(`[Escrow Release] Worker tx signature: ${workerTxSignature}`)
    
    console.log(`[Escrow Release] Confirming worker transaction...`)
    await connection.confirmTransaction(workerTxSignature, 'confirmed')
    console.log(`[Escrow Release] ✅ Worker payment confirmed`)
    
    // ==================== TRANSACTION 2: Transfer Fee to Platform ====================
    
    console.log(`[Escrow Release] Building fee transaction...`)
    const feeTx = new Transaction()
    
    // Create fee ATA if needed
    if (!feeAccountInfo) {
      console.log(`[Escrow Release] Adding instruction to create fee ATA`)
      feeTx.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet,
          feeTokenAccount,
          feeWallet,
          tokenMintPubkey
        )
      )
    }
    
    // Transfer fee
    const feeAmountRaw = Math.floor(feeAmount * Math.pow(10, decimals))
    console.log(`[Escrow Release] Fee amount (raw): ${feeAmountRaw}`)
    
    feeTx.add(
      createTransferInstruction(
        escrowTokenAccount,
        feeTokenAccount,
        escrowWallet,
        feeAmountRaw
      )
    )
    
    // Set transaction metadata
    const { blockhash: feeBlockhash } = await connection.getLatestBlockhash('confirmed')
    feeTx.recentBlockhash = feeBlockhash
    feeTx.feePayer = escrowWallet
    
    // Sign and send fee transaction
    console.log(`[Escrow Release] Signing fee transaction...`)
    feeTx.sign(escrowKeypair)
    
    console.log(`[Escrow Release] Sending fee transaction...`)
    const feeTxSignature = await connection.sendRawTransaction(
      feeTx.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    )
    console.log(`[Escrow Release] Fee tx signature: ${feeTxSignature}`)
    
    console.log(`[Escrow Release] Confirming fee transaction...`)
    await connection.confirmTransaction(feeTxSignature, 'confirmed')
    console.log(`[Escrow Release] ✅ Fee collection confirmed`)

    const duration = Date.now() - startTime
    console.log(`[Escrow Release] ✅ Complete in ${duration}ms`)
    
    return {
      success: true,
      workerTxSignature,
      feeTxSignature,
      workerReceived: workerAmount,
      feeCollected: feeAmount
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Escrow Release] ❌ Failed after ${duration}ms:`, error)
    
    // Extract meaningful error message
    let errorMessage = 'Unknown error during payment release'
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Add specific context for common errors
      if (error.message.includes('Insufficient funds')) {
        errorMessage = `Escrow has insufficient balance for this transaction`
      } else if (error.message.includes('Invalid public key')) {
        errorMessage = `Invalid wallet address provided`
      } else if (error.message.includes('Transaction simulation failed')) {
        errorMessage = `Transaction simulation failed - check escrow balance and token accounts`
      }
    }
    
    return {
      success: false,
      workerReceived: 0,
      feeCollected: 0,
      error: errorMessage
    }
  }
}

/**
 * Validate that escrow has sufficient balance for a payment release
 * 
 * This function checks the escrow wallet's token account balance before
 * attempting a release. It's recommended to call this before starting
 * a release transaction to fail fast if funds are insufficient.
 * 
 * **Use Cases:**
 * - Pre-flight validation before releasing payment
 * - Admin dashboard monitoring of escrow health
 * - Alerting system for low escrow balances
 * 
 * **Security:**
 * - Only reads from chain, no transactions
 * - Does not expose private key material
 * - Safe to call frequently
 * 
 * @param connection - Solana connection instance
 * @param tokenMint - Token mint address to check
 * @param expectedAmount - Required amount (in tokens, not raw units)
 * @param decimals - Token decimal places
 * @returns Validation result with error if insufficient
 * 
 * @example
 * ```typescript
 * const validation = await validateEscrowBalance(
 *   connection,
 *   job.escrow_token_mint,
 *   job.escrow_amount_tokens,
 *   9 // SOL decimals
 * )
 * 
 * if (!validation.valid) {
 *   console.error('Cannot release:', validation.error)
 *   // Alert admins, pause auto-release, etc.
 * }
 * ```
 */
export async function validateEscrowBalance(
  connection: Connection,
  tokenMint: string,
  expectedAmount: number,
  decimals: number
): Promise<{ valid: boolean; actualBalance?: number; error?: string }> {
  try {
    console.log(`[Escrow Validation] Checking balance for ${tokenMint}`)
    console.log(`[Escrow Validation] Expected: ${expectedAmount}`)
    
    // Get escrow wallet keypair
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      throw new Error('Escrow wallet not configured')
    }
    
    const escrowKeypair = Keypair.fromSecretKey(
      bs58.decode(escrowPrivateKey)
    )
    
    // Get token account address
    const tokenMintPubkey = new PublicKey(tokenMint)
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      escrowKeypair.publicKey
    )
    
    console.log(`[Escrow Validation] Token account: ${escrowTokenAccount.toString()}`)
    
    // Fetch balance
    const balance = await connection.getTokenAccountBalance(escrowTokenAccount)
    const actualBalance = parseFloat(balance.value.amount) / Math.pow(10, decimals)
    
    console.log(`[Escrow Validation] Actual balance: ${actualBalance}`)
    
    // Validate sufficient balance
    if (actualBalance < expectedAmount) {
      const error = `Insufficient escrow balance (have ${actualBalance}, need ${expectedAmount})`
      console.error(`[Escrow Validation] ❌ ${error}`)
      return {
        valid: false,
        actualBalance,
        error
      }
    }
    
    console.log(`[Escrow Validation] ✅ Balance sufficient`)
    return { 
      valid: true,
      actualBalance
    }
    
  } catch (error) {
    console.error('[Escrow Validation] ❌ Validation failed:', error)
    
    let errorMessage = 'Balance validation failed'
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Provide specific error context
      if (error.message.includes('could not find account')) {
        errorMessage = 'Token account does not exist for this mint'
      }
    }
    
    return {
      valid: false,
      error: errorMessage
    }
  }
}

/**
 * Release payment with automatic retry tracking and logging
 * 
 * This function wraps releasePaymentFromEscrow with comprehensive retry logic:
 * - Tracks attempt number for each release
 * - Determines if errors are retryable
 * - Logs all attempts to database
 * - Returns whether another retry should be attempted
 * 
 * **Retry Strategy:**
 * - Maximum 3 attempts per job
 * - Only retries on transient/network errors
 * - Logs success/failure to job_escrow_transactions
 * - Returns shouldRetry flag for cron job handling
 * 
 * **Retryable Errors:**
 * - Blockhash not found (transaction too old)
 * - Network errors and timeouts
 * - RPC errors and connection issues
 * - Transaction simulation failures
 * 
 * **Non-Retryable Errors:**
 * - Insufficient funds (needs manual intervention)
 * - Invalid wallet addresses
 * - Missing environment configuration
 * 
 * @param params - Release payment parameters
 * @param attemptNumber - Current attempt number (1-indexed, defaults to 1)
 * @returns Release result with shouldRetry flag
 * 
 * @example
 * ```typescript
 * // First attempt
 * const result = await releasePaymentWithRetry(params, 1)
 * 
 * if (!result.success && result.shouldRetry) {
 *   // Retry on next cron run
 *   console.log('Will retry on next cron execution')
 * } else if (!result.success && !result.shouldRetry) {
 *   // Max retries exceeded or non-retryable error
 *   console.log('Admin intervention required')
 *   await notifyAdmin(params.jobId, result.error)
 * }
 * ```
 */
export async function releasePaymentWithRetry(
  params: ReleasePaymentParams,
  attemptNumber: number = 1
): Promise<ReleasePaymentResult & { shouldRetry: boolean }> {
  const startTime = Date.now()
  
  try {
    console.log(`[Escrow Release Retry] Attempt ${attemptNumber}/3 for job ${params.jobId}`)
    
    // Attempt the release
    const result = await releasePaymentFromEscrow(params)
    
    if (!result.success) {
      // Determine if should retry
      const shouldRetry = attemptNumber < 3 && isRetryableError(result.error)
      
      console.log(`[Escrow Release Retry] Attempt ${attemptNumber} failed: ${result.error}`)
      console.log(`[Escrow Release Retry] Should retry: ${shouldRetry}`)
      
      // Log failure to database
      await logReleaseAttempt({
        job_id: params.jobId,
        attempt_number: attemptNumber,
        success: false,
        error_message: result.error,
        should_retry: shouldRetry,
        duration_ms: Date.now() - startTime,
        worker_wallet: params.workerWallet,
        escrow_amount: params.escrowAmount,
        token_mint: params.tokenMint
      })
      
      return {
        ...result,
        shouldRetry
      }
    }
    
    // Success - log it
    console.log(`[Escrow Release Retry] ✅ Attempt ${attemptNumber} succeeded`)
    console.log(`[Escrow Release Retry] Worker received: ${result.workerReceived}`)
    console.log(`[Escrow Release Retry] Fee collected: ${result.feeCollected}`)
    
    await logReleaseAttempt({
      job_id: params.jobId,
      attempt_number: attemptNumber,
      success: true,
      worker_tx_signature: result.workerTxSignature,
      fee_tx_signature: result.feeTxSignature,
      worker_amount: result.workerReceived,
      fee_amount: result.feeCollected,
      duration_ms: Date.now() - startTime,
      worker_wallet: params.workerWallet,
      escrow_amount: params.escrowAmount,
      token_mint: params.tokenMint
    })
    
    return {
      ...result,
      shouldRetry: false
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    const shouldRetry = attemptNumber < 3
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`[Escrow Release Retry] ❌ Attempt ${attemptNumber} threw exception:`, error)
    console.log(`[Escrow Release Retry] Should retry: ${shouldRetry}`)
    
    // Log exception to database
    await logReleaseAttempt({
      job_id: params.jobId,
      attempt_number: attemptNumber,
      success: false,
      error_message: errorMessage,
      should_retry: shouldRetry,
      duration_ms: duration,
      worker_wallet: params.workerWallet,
      escrow_amount: params.escrowAmount,
      token_mint: params.tokenMint
    })
    
    return {
      success: false,
      error: errorMessage,
      workerReceived: 0,
      feeCollected: 0,
      shouldRetry
    }
  }
}

/**
 * Determine if an error is transient and should be retried
 * 
 * Analyzes error messages to identify temporary failures that may
 * succeed on retry vs permanent failures requiring intervention.
 * 
 * **Retryable Patterns:**
 * - Blockhash expired (transaction too old)
 * - Network connectivity issues
 * - RPC node temporary failures
 * - Connection timeouts
 * - Rate limiting (429 errors)
 * 
 * **Non-Retryable Patterns:**
 * - Insufficient funds
 * - Invalid addresses
 * - Configuration errors
 * - Permission/signature errors
 * 
 * @param error - Error message to analyze
 * @returns true if error should be retried, false otherwise
 */
function isRetryableError(error?: string): boolean {
  if (!error) return false
  
  const errorLower = error.toLowerCase()
  
  // Retry on network/temporary errors
  const retryablePatterns = [
    'blockhash not found',
    'blockhash has expired',
    'transaction too old',
    'network error',
    'timeout',
    'timed out',
    'rpc error',
    'connection refused',
    'connection reset',
    'econnrefused',
    'econnreset',
    'etimedout',
    'transaction simulation failed',
    'rate limit',
    '429',
    'too many requests',
    'temporary failure',
    'try again',
    'node is unhealthy'
  ]
  
  // Don't retry on permanent errors
  const nonRetryablePatterns = [
    'insufficient funds',
    'insufficient balance',
    'invalid public key',
    'invalid wallet',
    'not configured',
    'missing',
    'invalid signature',
    'unauthorized'
  ]
  
  // Check for non-retryable patterns first (higher priority)
  const hasNonRetryable = nonRetryablePatterns.some(pattern => 
    errorLower.includes(pattern)
  )
  
  if (hasNonRetryable) {
    console.log(`[Retry Check] Non-retryable error detected: ${error}`)
    return false
  }
  
  // Check for retryable patterns
  const isRetryable = retryablePatterns.some(pattern => 
    errorLower.includes(pattern)
  )
  
  if (isRetryable) {
    console.log(`[Retry Check] Retryable error detected: ${error}`)
  } else {
    console.log(`[Retry Check] Unknown error type (defaulting to non-retryable): ${error}`)
  }
  
  return isRetryable
}

/**
 * Log a payment release attempt to the database
 * 
 * Creates a comprehensive audit trail of all release attempts including:
 * - Success/failure status
 * - Attempt number
 * - Transaction signatures (on success)
 * - Error messages (on failure)
 * - Should retry flag
 * - Execution duration
 * 
 * Uses job_escrow_transactions table with enhanced retry tracking.
 * 
 * @param data - Attempt data to log
 */
async function logReleaseAttempt(data: {
  job_id: string
  attempt_number: number
  success: boolean
  error_message?: string
  should_retry?: boolean
  worker_tx_signature?: string
  fee_tx_signature?: string
  worker_amount?: number
  fee_amount?: number
  duration_ms?: number
  worker_wallet: string
  escrow_amount: number
  token_mint: string
}) {
  try {
    console.log(`[Release Attempt Log] Logging attempt ${data.attempt_number} for job ${data.job_id}`)
    
    // Get escrow wallet address
    const escrowWalletAddress = process.env.ESCROW_WALLET_ADDRESS || 
                                process.env.FEE_WALLET_ADDRESS || 
                                'UNKNOWN'
    
    // Insert into job_escrow_transactions table
    const { error } = await supabase
      .from('job_escrow_transactions')
      .insert({
        job_id: data.job_id,
        transaction_type: 'release_to_worker',
        from_wallet: escrowWalletAddress,
        to_wallet: data.worker_wallet,
        amount_tokens: data.worker_amount || data.escrow_amount,
        token_mint: data.token_mint,
        token_symbol: 'SOL', // TODO: Get from token metadata
        tx_signature: data.worker_tx_signature || null,
        status: data.success ? 'confirmed' : 'failed',
        retry_count: data.attempt_number,
        error_message: data.error_message || null,
        created_at: new Date().toISOString(),
        confirmed_at: data.success ? new Date().toISOString() : null
      })
    
    if (error) {
      console.error('[Release Attempt Log] Failed to log attempt:', error)
      // Don't throw - logging failures shouldn't break the release flow
    } else {
      console.log(`[Release Attempt Log] ✅ Logged attempt ${data.attempt_number}`)
    }
    
    // If we have a fee transaction, log that too
    if (data.success && data.fee_tx_signature) {
      const feeWalletAddress = await getFeeWallet() || 'UNKNOWN'
      
      const { error: feeError } = await supabase
        .from('job_escrow_transactions')
        .insert({
          job_id: data.job_id,
          transaction_type: 'fee_collection',
          from_wallet: escrowWalletAddress,
          to_wallet: feeWalletAddress,
          amount_tokens: data.fee_amount || 0,
          token_mint: data.token_mint,
          token_symbol: 'SOL', // TODO: Get from token metadata
          tx_signature: data.fee_tx_signature,
          status: 'confirmed',
          retry_count: data.attempt_number,
          created_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString()
        })
      
      if (feeError) {
        console.error('[Release Attempt Log] Failed to log fee transaction:', feeError)
      } else {
        console.log('[Release Attempt Log] ✅ Logged fee transaction')
      }
    }
    
  } catch (error) {
    console.error('[Release Attempt Log] Exception while logging:', error)
    // Don't throw - logging failures shouldn't break the release flow
  }
}

