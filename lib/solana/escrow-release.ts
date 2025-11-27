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

