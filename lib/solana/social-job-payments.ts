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

