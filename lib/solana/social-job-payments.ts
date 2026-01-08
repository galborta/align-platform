/**
 * Social Media Job Payment Transactions
 * 
 * Helper functions for creating multi-recipient Solana payment transactions
 * for social media engagement jobs. Handles:
 * - Worker payments (proportional to follower count)
 * - Platform fee collection (5% of tier budget)
 * - Poster refund (unused budget from lower tier)
 * 
 * @module lib/solana/social-job-payments
 */

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
import bs58 from 'bs58'

// ==================== INTERFACES ====================

/**
 * Payment recipient information for a single worker
 */
export interface PaymentRecipient {
  /** Worker's wallet address */
  worker_wallet: string
  /** Payment amount in tokens (not raw units) */
  payment_amount_tokens: number
  /** Optional submission ID for tracking */
  submission_id?: string
}

/**
 * Parameters for creating a social job payment transaction
 */
export interface SocialJobPaymentParams {
  /** Solana connection instance */
  connection: Connection
  /** Token mint address for the payment token */
  tokenMint: PublicKey
  /** Platform fee wallet address */
  platformFeeWallet: PublicKey
  /** Poster wallet address (for refunds) */
  posterWallet: PublicKey
  /** Array of workers to pay */
  recipients: PaymentRecipient[]
  /** Platform fee amount in tokens */
  platformFeeAmount: number
  /** Refund amount for unused budget in tokens */
  refundAmount: number
  /** Token decimal places (default: 9) */
  decimals?: number
}

/**
 * Result of a social job payment execution
 */
export interface SocialJobPaymentResult {
  /** Whether the payment was successful */
  success: boolean
  /** Main transaction signature (worker payments) */
  txSignature?: string
  /** Number of workers paid */
  workersPaid: number
  /** Total amount distributed to workers */
  totalWorkerPayment: number
  /** Platform fee collected */
  feeCollected: number
  /** Amount refunded to poster */
  refundAmount: number
  /** Error message if failed */
  error?: string
}

/**
 * Result of escrow balance validation
 */
export interface EscrowBalanceValidation {
  /** Whether balance is sufficient */
  valid: boolean
  /** Actual balance in tokens */
  actualBalance?: number
  /** Required amount in tokens */
  requiredAmount?: number
  /** Error message if validation failed */
  error?: string
}

// ==================== MAIN TRANSACTION BUILDER ====================

/**
 * Creates a multi-recipient payment transaction for social media jobs
 * 
 * This function builds a single transaction containing:
 * 1. SPL token transfers to all approved workers
 * 2. Platform fee transfer to fee wallet
 * 3. Refund transfer to poster (if any unused budget)
 * 
 * **Transaction Structure:**
 * ```
 * [Create Worker ATAs if needed] (N instructions)
 * [Transfer to Worker 1]
 * [Transfer to Worker 2]
 * ...
 * [Transfer to Worker N]
 * [Create Platform Fee ATA if needed]
 * [Transfer Platform Fee]
 * [Create Poster ATA if needed]
 * [Transfer Refund to Poster]
 * ```
 * 
 * **Note:** Transaction is NOT signed - caller must sign with escrow keypair
 * 
 * @param params - Payment parameters
 * @returns Transaction ready for signing
 * @throws {Error} If any wallet address is invalid
 * 
 * @example
 * ```typescript
 * const tx = await createSocialJobPaymentTransaction({
 *   connection,
 *   tokenMint: new PublicKey(job.escrow_token_mint),
 *   platformFeeWallet: new PublicKey(feeWalletAddress),
 *   posterWallet: new PublicKey(job.poster_wallet),
 *   recipients: [
 *     { worker_wallet: 'Abc123...', payment_amount_tokens: 100 },
 *     { worker_wallet: 'Def456...', payment_amount_tokens: 200 },
 *   ],
 *   platformFeeAmount: 15,
 *   refundAmount: 185, // Unused budget
 *   decimals: 9
 * })
 * 
 * // Sign with escrow keypair
 * tx.sign(escrowKeypair)
 * const signature = await connection.sendRawTransaction(tx.serialize())
 * ```
 */
export async function createSocialJobPaymentTransaction({
  connection,
  tokenMint,
  platformFeeWallet,
  posterWallet,
  recipients,
  platformFeeAmount,
  refundAmount,
  decimals = 9
}: SocialJobPaymentParams): Promise<Transaction> {
  const startTime = Date.now()
  
  console.log(`[Social Job Payment] Building transaction for ${recipients.length} recipients`)
  console.log(`[Social Job Payment] Platform fee: ${platformFeeAmount}, Refund: ${refundAmount}`)
  
  // Validate escrow wallet configuration
  const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
  if (!escrowPrivateKey) {
    throw new Error('ESCROW_WALLET_PRIVATE_KEY not configured in environment')
  }

  // Decode escrow keypair
  let escrowKeypair: Keypair
  try {
    escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
  } catch (error) {
    throw new Error('Invalid escrow private key format (must be base58 encoded)')
  }

  const escrowWallet = escrowKeypair.publicKey
  console.log(`[Social Job Payment] Escrow wallet: ${escrowWallet.toString()}`)

  // Get escrow token account
  const escrowTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    escrowWallet
  )
  console.log(`[Social Job Payment] Escrow ATA: ${escrowTokenAccount.toString()}`)

  const transaction = new Transaction()

  // ==================== 1. WORKER PAYMENTS ====================
  
  console.log(`[Social Job Payment] Adding ${recipients.length} worker transfers...`)
  
  // Collect all worker ATAs to check existence in batch
  const workerATAChecks: Array<{
    pubkey: PublicKey
    workerPubkey: PublicKey
    recipient: PaymentRecipient
    ata: PublicKey
  }> = []

  for (const recipient of recipients) {
    try {
      const workerPubkey = new PublicKey(recipient.worker_wallet)
      const workerATA = await getAssociatedTokenAddress(
        tokenMint,
        workerPubkey
      )
      workerATAChecks.push({
        pubkey: workerATA,
        workerPubkey,
        recipient,
        ata: workerATA
      })
    } catch (error) {
      throw new Error(`Invalid worker wallet address: ${recipient.worker_wallet}`)
    }
  }

  // Check which ATAs exist (batch request)
  const ataInfos = await connection.getMultipleAccountsInfo(
    workerATAChecks.map(w => w.ata)
  )

  // Add instructions for each worker
  for (let i = 0; i < workerATAChecks.length; i++) {
    const { workerPubkey, recipient, ata } = workerATAChecks[i]
    const ataExists = ataInfos[i] !== null

    // Create ATA if it doesn't exist
    if (!ataExists) {
      console.log(`[Social Job Payment] Creating ATA for worker ${recipient.worker_wallet.slice(0, 8)}...`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet, // payer
          ata,
          workerPubkey,
          tokenMint
        )
      )
    }

    // Add transfer instruction
    const amountRaw = Math.floor(recipient.payment_amount_tokens * Math.pow(10, decimals))
    console.log(`[Social Job Payment] Transfer ${recipient.payment_amount_tokens} tokens to ${recipient.worker_wallet.slice(0, 8)}... (raw: ${amountRaw})`)

    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        ata,
        escrowWallet,
        amountRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    )
  }

  // ==================== 2. PLATFORM FEE ====================
  
  if (platformFeeAmount > 0) {
    console.log(`[Social Job Payment] Adding platform fee transfer: ${platformFeeAmount} tokens`)
    
    const platformATA = await getAssociatedTokenAddress(
      tokenMint,
      platformFeeWallet
    )

    // Check if platform ATA exists
    const platformATAInfo = await connection.getAccountInfo(platformATA)
    
    if (!platformATAInfo) {
      console.log(`[Social Job Payment] Creating platform fee ATA`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet,
          platformATA,
          platformFeeWallet,
          tokenMint
        )
      )
    }

    const feeAmountRaw = Math.floor(platformFeeAmount * Math.pow(10, decimals))
    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        platformATA,
        escrowWallet,
        feeAmountRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    )
  }

  // ==================== 3. POSTER REFUND ====================
  
  if (refundAmount > 0) {
    console.log(`[Social Job Payment] Adding poster refund: ${refundAmount} tokens`)
    
    const posterATA = await getAssociatedTokenAddress(
      tokenMint,
      posterWallet
    )

    // Check if poster ATA exists
    const posterATAInfo = await connection.getAccountInfo(posterATA)
    
    if (!posterATAInfo) {
      console.log(`[Social Job Payment] Creating poster refund ATA`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet,
          posterATA,
          posterWallet,
          tokenMint
        )
      )
    }

    const refundAmountRaw = Math.floor(refundAmount * Math.pow(10, decimals))
    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        posterATA,
        escrowWallet,
        refundAmountRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    )
  }

  // ==================== 4. FINALIZE TRANSACTION ====================
  
  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  transaction.feePayer = escrowWallet

  const duration = Date.now() - startTime
  console.log(`[Social Job Payment] Transaction built in ${duration}ms with ${transaction.instructions.length} instructions`)

  return transaction
}

// ==================== EXECUTION HELPER ====================

/**
 * Executes a social job payment transaction
 * 
 * Signs and sends the transaction using the escrow wallet,
 * then waits for confirmation.
 * 
 * @param connection - Solana connection
 * @param transaction - Transaction to execute
 * @returns Execution result with signature
 * 
 * @example
 * ```typescript
 * const tx = await createSocialJobPaymentTransaction(params)
 * const result = await executeSocialJobPayment(connection, tx)
 * 
 * if (result.success) {
 *   console.log('Payment executed:', result.txSignature)
 * }
 * ```
 */
export async function executeSocialJobPayment(
  connection: Connection,
  transaction: Transaction
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  const startTime = Date.now()
  
  try {
    // Get escrow keypair for signing
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      throw new Error('ESCROW_WALLET_PRIVATE_KEY not configured')
    }

    const escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))

    console.log(`[Social Job Payment] Signing transaction...`)
    transaction.sign(escrowKeypair)

    console.log(`[Social Job Payment] Sending transaction...`)
    const txSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    )
    console.log(`[Social Job Payment] Transaction sent: ${txSignature}`)

    console.log(`[Social Job Payment] Confirming transaction...`)
    await connection.confirmTransaction(txSignature, 'confirmed')

    const duration = Date.now() - startTime
    console.log(`[Social Job Payment] ✅ Transaction confirmed in ${duration}ms`)

    return {
      success: true,
      txSignature
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Social Job Payment] ❌ Failed after ${duration}ms:`, error)

    let errorMessage = 'Unknown error during payment execution'
    if (error instanceof Error) {
      errorMessage = error.message

      // Add context for common errors
      if (error.message.includes('Insufficient funds')) {
        errorMessage = 'Escrow has insufficient balance for this transaction'
      } else if (error.message.includes('Invalid public key')) {
        errorMessage = 'Invalid wallet address provided'
      } else if (error.message.includes('Transaction simulation failed')) {
        errorMessage = 'Transaction simulation failed - check escrow balance and token accounts'
      }
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validates that escrow has sufficient balance for social job payment
 * 
 * Checks that the escrow token account has enough tokens to cover:
 * - All worker payments
 * - Platform fee
 * - Poster refund (which is already in escrow)
 * 
 * @param connection - Solana connection
 * @param tokenMint - Token mint address
 * @param requiredAmount - Total required amount in tokens
 * @param decimals - Token decimal places (default: 9)
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const totalRequired = workerPaymentsTotal + platformFee
 * const validation = await validateSocialJobEscrowBalance(
 *   connection,
 *   new PublicKey(tokenMint),
 *   totalRequired
 * )
 * 
 * if (!validation.valid) {
 *   throw new Error(`Insufficient escrow balance: ${validation.error}`)
 * }
 * ```
 */
export async function validateSocialJobEscrowBalance(
  connection: Connection,
  tokenMint: PublicKey,
  requiredAmount: number,
  decimals: number = 9
): Promise<EscrowBalanceValidation> {
  try {
    console.log(`[Social Job Validation] Checking escrow balance`)
    console.log(`[Social Job Validation] Required: ${requiredAmount} tokens`)

    // Get escrow keypair
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      return {
        valid: false,
        error: 'Escrow wallet not configured'
      }
    }

    const escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
    
    // Get escrow token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowKeypair.publicKey
    )

    console.log(`[Social Job Validation] Escrow ATA: ${escrowTokenAccount.toString()}`)

    // Fetch balance
    const balance = await connection.getTokenAccountBalance(escrowTokenAccount)
    const actualBalance = parseFloat(balance.value.amount) / Math.pow(10, decimals)

    console.log(`[Social Job Validation] Actual balance: ${actualBalance} tokens`)

    if (actualBalance < requiredAmount) {
      const error = `Insufficient escrow balance (have ${actualBalance}, need ${requiredAmount})`
      console.error(`[Social Job Validation] ❌ ${error}`)
      return {
        valid: false,
        actualBalance,
        requiredAmount,
        error
      }
    }

    console.log(`[Social Job Validation] ✅ Balance sufficient`)
    return {
      valid: true,
      actualBalance,
      requiredAmount
    }

  } catch (error) {
    console.error('[Social Job Validation] ❌ Validation failed:', error)

    let errorMessage = 'Balance validation failed'
    if (error instanceof Error) {
      if (error.message.includes('could not find account')) {
        errorMessage = 'Token account does not exist for this mint'
      } else {
        errorMessage = error.message
      }
    }

    return {
      valid: false,
      error: errorMessage
    }
  }
}

// ==================== CALCULATION HELPERS ====================

/**
 * Calculates total amount needed from escrow for social job payment
 * 
 * Formula: workerPayments + platformFee
 * (Refund comes from the same escrow, doesn't add to requirement)
 * 
 * @param workerPaymentsTotal - Sum of all worker payments
 * @param platformFee - Platform fee amount
 * @returns Total amount needed from escrow
 * 
 * @example
 * ```typescript
 * const totalWorkerPayments = payments.reduce((sum, p) => sum + p.payment_amount_tokens, 0)
 * const platformFee = tierBudget * 0.05
 * const totalNeeded = calculateTotalEscrowNeed(totalWorkerPayments, platformFee)
 * ```
 */
export function calculateTotalEscrowNeed(
  workerPaymentsTotal: number,
  platformFee: number
): number {
  return workerPaymentsTotal + platformFee
}

/**
 * Estimates transaction fees for social job payment
 * 
 * @param numRecipients - Number of workers to pay
 * @param hasRefund - Whether there's a refund to poster
 * @returns Estimated fee in SOL
 */
export function estimateSocialJobPaymentFees(
  numRecipients: number,
  hasRefund: boolean
): number {
  // Base transaction fee ~0.000005 SOL
  // Each transfer instruction adds ~0.000001 SOL
  // ATA creation adds ~0.00203 SOL rent
  // Add priority fee buffer
  
  const baseFee = 0.000005
  const perTransferFee = 0.000001
  const priorityBuffer = 1.5

  // Count transfers: workers + platform fee + optional refund
  const transferCount = numRecipients + 1 + (hasRefund ? 1 : 0)
  
  return (baseFee + (perTransferFee * transferCount)) * priorityBuffer
}

/**
 * Formats a transaction summary for logging
 * 
 * @param params - Payment parameters
 * @returns Formatted summary string
 */
export function formatPaymentSummary(params: SocialJobPaymentParams): string {
  const totalWorkerPayments = params.recipients.reduce(
    (sum, r) => sum + r.payment_amount_tokens,
    0
  )

  return [
    `=== Social Job Payment Summary ===`,
    `Workers: ${params.recipients.length}`,
    `Total Worker Payments: ${totalWorkerPayments.toFixed(4)} tokens`,
    `Platform Fee: ${params.platformFeeAmount.toFixed(4)} tokens`,
    `Poster Refund: ${params.refundAmount.toFixed(4)} tokens`,
    `Total from Escrow: ${(totalWorkerPayments + params.platformFeeAmount + params.refundAmount).toFixed(4)} tokens`,
    `================================`
  ].join('\n')
}

// ==================== INSTANT PAYMENT SYSTEM ====================

/**
 * Parameters for instant submission payment
 */
export interface InstantPaymentParams {
  /** Token mint address (SPL token or SOL) */
  tokenMint: PublicKey
  /** Worker's wallet address to receive payment */
  workerWallet: PublicKey
  /** Platform fee wallet address */
  platformFeeWallet: PublicKey
  /** Base payment amount in tokens (e.g., 50 for 50 tokens) */
  basePaymentAmount: number
  /** Platform fee as decimal (e.g., 0.05 for 5%) */
  platformFeePercentage: number
  /** Optional impression bonus amount in tokens */
  impressionBonusAmount?: number
  /** Token decimal places (default: 9) */
  decimals?: number
  /** Submission ID for logging */
  submissionId?: string
  /** Job ID for logging */
  jobId?: string
}

/**
 * Result of instant payment execution
 */
export interface InstantPaymentResult {
  /** Whether the payment was successful */
  success: boolean
  /** Solana transaction signature if successful */
  txSignature?: string
  /** Number of retry attempts made */
  retryAttempts?: number
  /** Total payment amount (base + bonus) */
  totalPayment?: number
  /** Platform fee amount collected */
  platformFee?: number
  /** Detailed error message if failed */
  error?: string
  /** Error code for programmatic handling */
  errorCode?: 'INSUFFICIENT_BALANCE' | 'RPC_TIMEOUT' | 'TRANSACTION_FAILED' | 'INVALID_ADDRESS' | 'UNKNOWN'
}

/**
 * Delay helper for exponential backoff
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculates exponential backoff delay
 * 
 * @param attempt - Attempt number (0-based)
 * @param baseDelay - Base delay in milliseconds (default: 30000 = 30s)
 * @returns Delay in milliseconds
 */
function getExponentialBackoffDelay(attempt: number, baseDelay: number = 30000): number {
  // Attempt 0: 0ms (immediate)
  // Attempt 1: 30s
  // Attempt 2: 60s
  // Attempt 3: 120s
  return attempt === 0 ? 0 : baseDelay * Math.pow(2, attempt - 1)
}

/**
 * Creates and executes instant payment transaction for single submission approval
 * 
 * This is called immediately when poster approves a submission. Unlike the batch
 * payment at campaign end, this processes one worker at a time with instant execution.
 * 
 * **Payment Flow:**
 * 1. Validate escrow has sufficient balance
 * 2. Build transaction with worker payment + platform fee (+ optional bonus)
 * 3. Execute transaction with retry logic
 * 4. Return result with transaction signature or detailed error
 * 
 * **Transaction Structure:**
 * ```
 * Escrow Account (PDA)
 *   ├→ Worker Wallet (basePaymentAmount + impressionBonus)
 *   └→ Platform Fee Wallet (basePaymentAmount × feePercentage)
 * ```
 * 
 * **Retry Logic:**
 * - Attempt 1: Immediate (0ms)
 * - Attempt 2: 30s after first failure
 * - Attempt 3: 60s after second failure (90s total)
 * - Attempt 4: 120s after third failure (210s total)
 * - After 4 failures: return error, caller updates DB to 'approved_failed'
 * 
 * **Error Handling:**
 * - Insufficient balance → Returns error with balance details
 * - RPC timeout → Retries with exponential backoff
 * - Transaction failed → Returns detailed error message
 * - Invalid address → Returns error immediately (no retry)
 * 
 * @param connection - Solana connection instance
 * @param params - Instant payment parameters
 * @returns Payment result with signature or error
 * 
 * @example
 * ```typescript
 * // When poster approves submission:
 * const result = await executeInstantSubmissionPayment(connection, {
 *   tokenMint: new PublicKey(job.escrow_token_mint),
 *   workerWallet: new PublicKey(submission.worker_wallet),
 *   platformFeeWallet: new PublicKey(platformWallet),
 *   basePaymentAmount: 50, // $50 from their follower tier
 *   platformFeePercentage: 0.05, // 5%
 *   impressionBonusAmount: 10, // Optional $10 impression bonus
 *   submissionId: submission.id,
 *   jobId: job.id
 * })
 * 
 * if (result.success) {
 *   // Update submission: approved_pending_payment → approved
 *   await updateSubmission(submissionId, {
 *     social_approval_status: 'approved',
 *     social_payment_tx_signature: result.txSignature
 *   })
 * } else {
 *   // Update submission: approved_pending_payment → approved_failed
 *   await updateSubmission(submissionId, {
 *     social_approval_status: 'approved_failed',
 *     social_payment_failed_reason: result.error,
 *     social_payment_retry_count: result.retryAttempts
 *   })
 * }
 * ```
 */
export async function executeInstantSubmissionPayment(
  connection: Connection,
  params: InstantPaymentParams
): Promise<InstantPaymentResult> {
  const startTime = Date.now()
  const maxRetries = 4 // 1 initial + 3 retries
  
  const {
    tokenMint,
    workerWallet,
    platformFeeWallet,
    basePaymentAmount,
    platformFeePercentage,
    impressionBonusAmount = 0,
    decimals = 9,
    submissionId = 'unknown',
    jobId = 'unknown'
  } = params

  console.log(`\n${'='.repeat(80)}`)
  console.log(`[Instant Payment] Starting payment for submission ${submissionId}`)
  console.log(`[Instant Payment] Job: ${jobId}`)
  console.log(`[Instant Payment] Worker: ${workerWallet.toString()}`)
  console.log(`[Instant Payment] Base Payment: ${basePaymentAmount} tokens`)
  console.log(`[Instant Payment] Impression Bonus: ${impressionBonusAmount} tokens`)
  console.log(`[Instant Payment] Platform Fee: ${(basePaymentAmount * platformFeePercentage).toFixed(4)} tokens (${(platformFeePercentage * 100).toFixed(1)}%)`)
  console.log(`${'='.repeat(80)}\n`)

  // Calculate amounts
  const totalPaymentToWorker = basePaymentAmount + impressionBonusAmount
  const platformFee = basePaymentAmount * platformFeePercentage
  const totalFromEscrow = totalPaymentToWorker + platformFee

  console.log(`[Instant Payment] Total to worker: ${totalPaymentToWorker} tokens`)
  console.log(`[Instant Payment] Total from escrow: ${totalFromEscrow} tokens`)

  // ==================== 1. VALIDATE ESCROW BALANCE ====================

  console.log(`\n[Instant Payment] Step 1: Validating escrow balance...`)
  
  const balanceValidation = await validateSocialJobEscrowBalance(
    connection,
    tokenMint,
    totalFromEscrow,
    decimals
  )

  if (!balanceValidation.valid) {
    const error = balanceValidation.error || 'Insufficient escrow balance'
    console.error(`[Instant Payment] ❌ Balance validation failed: ${error}`)
    console.log(`[Instant Payment] Required: ${totalFromEscrow} tokens`)
    console.log(`[Instant Payment] Available: ${balanceValidation.actualBalance || 0} tokens`)
    
    return {
      success: false,
      error: `Escrow balance too low. Expected ${totalFromEscrow.toFixed(4)}, found ${(balanceValidation.actualBalance || 0).toFixed(4)} tokens`,
      errorCode: 'INSUFFICIENT_BALANCE',
      retryAttempts: 0
    }
  }

  console.log(`[Instant Payment] ✅ Balance sufficient (${balanceValidation.actualBalance} tokens available)`)

  // ==================== 2. RETRY LOOP WITH EXPONENTIAL BACKOFF ====================

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Calculate and apply delay for retries
      if (attempt > 0) {
        const delayMs = getExponentialBackoffDelay(attempt)
        console.log(`\n[Instant Payment] Retry attempt ${attempt}/${maxRetries - 1}`)
        console.log(`[Instant Payment] Waiting ${delayMs / 1000}s before retry...`)
        await delay(delayMs)
      }

      console.log(`\n[Instant Payment] Step 2: Building transaction (attempt ${attempt + 1}/${maxRetries})...`)

      // ==================== 3. GET ESCROW CONFIGURATION ====================

      const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
      if (!escrowPrivateKey) {
        throw new Error('ESCROW_WALLET_PRIVATE_KEY not configured in environment')
      }

      let escrowKeypair: Keypair
      try {
        escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
      } catch (error) {
        return {
          success: false,
          error: 'Invalid escrow private key format (must be base58 encoded)',
          errorCode: 'INVALID_ADDRESS',
          retryAttempts: attempt
        }
      }

      const escrowWallet = escrowKeypair.publicKey
      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowWallet
      )

      console.log(`[Instant Payment] Escrow wallet: ${escrowWallet.toString()}`)
      console.log(`[Instant Payment] Escrow ATA: ${escrowTokenAccount.toString()}`)

      // ==================== 4. BUILD TRANSACTION ====================

      const transaction = new Transaction()

      // 4a. Worker payment
      console.log(`[Instant Payment] Adding worker payment: ${totalPaymentToWorker} tokens`)
      
      const workerATA = await getAssociatedTokenAddress(tokenMint, workerWallet)
      const workerATAInfo = await connection.getAccountInfo(workerATA)

      if (!workerATAInfo) {
        console.log(`[Instant Payment] Creating worker ATA: ${workerATA.toString()}`)
        transaction.add(
          createAssociatedTokenAccountInstruction(
            escrowWallet,
            workerATA,
            workerWallet,
            tokenMint
          )
        )
      }

      const workerAmountRaw = Math.floor(totalPaymentToWorker * Math.pow(10, decimals))
      transaction.add(
        createTransferInstruction(
          escrowTokenAccount,
          workerATA,
          escrowWallet,
          workerAmountRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      )
      console.log(`[Instant Payment] ✓ Worker transfer added (raw: ${workerAmountRaw})`)

      // 4b. Platform fee
      console.log(`[Instant Payment] Adding platform fee: ${platformFee.toFixed(4)} tokens`)
      
      const platformATA = await getAssociatedTokenAddress(tokenMint, platformFeeWallet)
      const platformATAInfo = await connection.getAccountInfo(platformATA)

      if (!platformATAInfo) {
        console.log(`[Instant Payment] Creating platform ATA: ${platformATA.toString()}`)
        transaction.add(
          createAssociatedTokenAccountInstruction(
            escrowWallet,
            platformATA,
            platformFeeWallet,
            tokenMint
          )
        )
      }

      const feeAmountRaw = Math.floor(platformFee * Math.pow(10, decimals))
      transaction.add(
        createTransferInstruction(
          escrowTokenAccount,
          platformATA,
          escrowWallet,
          feeAmountRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      )
      console.log(`[Instant Payment] ✓ Platform fee transfer added (raw: ${feeAmountRaw})`)

      // 4c. Finalize transaction
      const { blockhash } = await connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = escrowWallet

      console.log(`[Instant Payment] Transaction built with ${transaction.instructions.length} instructions`)

      // ==================== 5. SIGN AND SEND ====================

      console.log(`[Instant Payment] Step 3: Signing and sending transaction...`)
      transaction.sign(escrowKeypair)

      const txSignature = await connection.sendRawTransaction(
        transaction.serialize(),
        { 
          skipPreflight: false, 
          preflightCommitment: 'confirmed',
          maxRetries: 2 // RPC-level retries
        }
      )
      
      console.log(`[Instant Payment] Transaction sent: ${txSignature}`)
      console.log(`[Instant Payment] Waiting for confirmation...`)

      // ==================== 6. CONFIRM TRANSACTION ====================

      await connection.confirmTransaction(txSignature, 'confirmed')

      const duration = Date.now() - startTime
      console.log(`\n${'='.repeat(80)}`)
      console.log(`[Instant Payment] ✅ SUCCESS!`)
      console.log(`[Instant Payment] Transaction: ${txSignature}`)
      console.log(`[Instant Payment] Duration: ${duration}ms`)
      console.log(`[Instant Payment] Retry attempts: ${attempt}`)
      console.log(`[Instant Payment] Worker received: ${totalPaymentToWorker} tokens`)
      console.log(`[Instant Payment] Platform fee: ${platformFee.toFixed(4)} tokens`)
      console.log(`${'='.repeat(80)}\n`)

      return {
        success: true,
        txSignature,
        retryAttempts: attempt,
        totalPayment: totalPaymentToWorker,
        platformFee
      }

    } catch (error) {
      lastError = error as Error
      const duration = Date.now() - startTime
      
      console.error(`\n[Instant Payment] ❌ Attempt ${attempt + 1}/${maxRetries} failed after ${duration}ms`)
      console.error(`[Instant Payment] Error:`, error)

      // Determine if error is retryable
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isRetryable = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('429') ||
        errorMessage.includes('503') ||
        errorMessage.includes('network') ||
        errorMessage.includes('blockhash not found')

      // Don't retry for non-retryable errors
      if (!isRetryable) {
        console.error(`[Instant Payment] Non-retryable error detected, stopping retries`)
        break
      }

      // Don't retry if this was the last attempt
      if (attempt >= maxRetries - 1) {
        console.error(`[Instant Payment] Max retries reached, giving up`)
        break
      }

      console.log(`[Instant Payment] Error appears retryable, will retry...`)
    }
  }

  // ==================== 7. ALL RETRIES FAILED ====================

  const finalDuration = Date.now() - startTime
  console.error(`\n${'='.repeat(80)}`)
  console.error(`[Instant Payment] ❌ FAILED after ${finalDuration}ms`)
  console.error(`[Instant Payment] All ${maxRetries} attempts exhausted`)
  console.error(`[Instant Payment] Final error:`, lastError)
  console.error(`${'='.repeat(80)}\n`)

  // Categorize error for caller
  let errorCode: InstantPaymentResult['errorCode'] = 'UNKNOWN'
  let errorMessage = 'Unknown error during payment execution'

  if (lastError) {
    errorMessage = lastError.message

    if (errorMessage.includes('Insufficient funds') || errorMessage.includes('insufficient')) {
      errorCode = 'INSUFFICIENT_BALANCE'
      errorMessage = 'Escrow has insufficient balance for this transaction'
    } else if (errorMessage.includes('timeout') || errorMessage.includes('429') || errorMessage.includes('503')) {
      errorCode = 'RPC_TIMEOUT'
      errorMessage = `Network timeout after ${maxRetries} attempts. Last error: ${errorMessage}`
    } else if (errorMessage.includes('Invalid public key') || errorMessage.includes('invalid')) {
      errorCode = 'INVALID_ADDRESS'
      errorMessage = 'Invalid wallet address provided'
    } else if (errorMessage.includes('Transaction') || errorMessage.includes('simulation')) {
      errorCode = 'TRANSACTION_FAILED'
      errorMessage = `Transaction failed: ${errorMessage}`
    }
  }

  return {
    success: false,
    error: errorMessage,
    errorCode,
    retryAttempts: maxRetries - 1
  }
}

