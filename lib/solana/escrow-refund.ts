import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  TransactionInstruction
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { supabase } from '../supabase'
import bs58 from 'bs58'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

/**
 * Parameters for refunding escrow to poster
 */
export interface RefundEscrowParams {
  /** Solana connection instance */
  connection: Connection
  /** UUID of the job being cancelled */
  jobId: string
  /** Poster's wallet address (refund recipient) */
  posterWallet: string
  /** Token mint address (SPL token) */
  tokenMint: string
  /** Total amount to refund (payment + fee) */
  escrowAmount: number
  /** Token decimal places (e.g., 9 for SOL, 6 for USDC) */
  decimals: number
  /** Job title for transaction description */
  jobTitle?: string
}

/**
 * Result of escrow refund operation
 */
export interface RefundEscrowResult {
  /** Whether the refund was successful */
  success: boolean
  /** Transaction signature */
  txSignature?: string
  /** Actual amount refunded (in tokens, not raw units) */
  amountRefunded: number
  /** Error message if operation failed */
  error?: string
}

/**
 * Refund full escrow amount back to job poster when job is cancelled
 * 
 * This function performs a complete refund of all tokens locked in escrow
 * (both the job payment and platform fee) back to the poster's wallet.
 * 
 * **Use Cases:**
 * - Job cancelled by poster before completion
 * - Job cancelled due to worker missing deadline
 * - Dispute resolved in favor of poster (refund)
 * 
 * **Security Requirements:**
 * - ESCROW_WALLET_PRIVATE_KEY must be stored in secure environment variables
 * - Only callable through authorized API routes with poster verification
 * 
 * **Transaction Flow:**
 * 1. Validates escrow wallet private key exists
 * 2. Creates poster's Associated Token Account if needed
 * 3. Transfers full escrow amount back to poster
 * 4. Adds descriptive memo for transparency
 * 5. Logs transaction to database
 * 
 * @param params - Refund parameters
 * @returns Result object with signature and amount or error
 * 
 * @example
 * ```typescript
 * const result = await refundEscrowToPoster({
 *   connection: new Connection(rpcUrl),
 *   jobId: job.id,
 *   posterWallet: job.poster_wallet,
 *   tokenMint: job.escrow_token_mint,
 *   escrowAmount: job.escrow_amount_tokens,
 *   decimals: 9, // SOL
 *   jobTitle: job.title
 * })
 * 
 * if (result.success) {
 *   console.log('Refunded:', result.amountRefunded, 'tokens')
 *   console.log('Tx:', result.txSignature)
 * } else {
 *   console.error('Refund failed:', result.error)
 * }
 * ```
 */
export async function refundEscrowToPoster(
  params: RefundEscrowParams
): Promise<RefundEscrowResult> {
  const startTime = Date.now()

  try {
    const {
      connection,
      jobId,
      posterWallet,
      tokenMint,
      escrowAmount,
      decimals,
      jobTitle
    } = params

    console.log(`[Escrow Refund] Starting for job ${jobId}`)
    console.log(`[Escrow Refund] Refunding ${escrowAmount} tokens to ${posterWallet}`)

    // Validate environment configuration
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      const error = 'ESCROW_WALLET_PRIVATE_KEY not configured in environment'
      console.error(`[Escrow Refund] ${error}`)
      throw new Error(error)
    }

    // Decode escrow wallet keypair
    let escrowKeypair: Keypair
    try {
      escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
      console.log(`[Escrow Refund] Escrow wallet: ${escrowKeypair.publicKey.toString()}`)
    } catch (error) {
      const message = 'Invalid escrow private key format (must be base58 encoded)'
      console.error(`[Escrow Refund] ${message}`, error)
      throw new Error(message)
    }

    const escrowWallet = escrowKeypair.publicKey

    // Create public keys
    const tokenMintPubkey = new PublicKey(tokenMint)
    const posterPubkey = new PublicKey(posterWallet)

    // Get Associated Token Addresses
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      escrowWallet
    )

    const posterTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      posterPubkey
    )

    console.log(`[Escrow Refund] Escrow ATA: ${escrowTokenAccount.toString()}`)
    console.log(`[Escrow Refund] Poster ATA: ${posterTokenAccount.toString()}`)

    // Check if poster's token account exists
    const posterAccountInfo = await connection.getAccountInfo(posterTokenAccount)
    console.log(`[Escrow Refund] Poster ATA exists: ${!!posterAccountInfo}`)

    // Build transaction
    console.log(`[Escrow Refund] Building refund transaction...`)
    const transaction = new Transaction()

    // Create poster ATA if needed
    if (!posterAccountInfo) {
      console.log(`[Escrow Refund] Adding instruction to create poster ATA`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet, // payer (escrow pays rent)
          posterTokenAccount,
          posterPubkey,
          tokenMintPubkey
        )
      )
    }

    // Add memo for transparency
    const titleText = jobTitle ? ` for "${jobTitle.slice(0, 40)}${jobTitle.length > 40 ? '...' : ''}"` : ''
    const memoText = `🔓 Refund ${escrowAmount.toFixed(2)} tokens${titleText} - Job cancelled`
    console.log(`[Escrow Refund] Memo: ${memoText}`)
    
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoText, 'utf-8')
      })
    )

    // Transfer full amount back to poster
    const refundAmountRaw = Math.floor(escrowAmount * Math.pow(10, decimals))
    console.log(`[Escrow Refund] Refund amount (raw): ${refundAmountRaw}`)

    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        posterTokenAccount,
        escrowWallet,
        refundAmountRaw
      )
    )

    // Set transaction metadata
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = escrowWallet

    // Sign and send
    console.log(`[Escrow Refund] Signing transaction...`)
    transaction.sign(escrowKeypair)

    console.log(`[Escrow Refund] Sending transaction...`)
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    )
    console.log(`[Escrow Refund] Transaction sent: ${signature}`)

    // Confirm transaction
    console.log(`[Escrow Refund] Confirming transaction...`)
    await connection.confirmTransaction(signature, 'confirmed')

    const duration = Date.now() - startTime
    console.log(`[Escrow Refund] ✅ Refund confirmed in ${duration}ms`)

    // Log to database
    try {
      await supabase.from('job_escrow_transactions').insert({
        job_id: jobId,
        transaction_type: 'refund_to_poster',
        from_wallet: escrowWallet.toString(),
        to_wallet: posterWallet,
        amount_tokens: escrowAmount,
        token_mint: tokenMint,
        token_symbol: 'SOL', // TODO: Get from token metadata
        tx_signature: signature,
        status: 'confirmed',
        retry_count: 0,
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      })
      console.log(`[Escrow Refund] ✅ Logged to database`)
    } catch (dbError) {
      console.error('[Escrow Refund] Failed to log to database:', dbError)
      // Don't fail the refund if logging fails
    }

    return {
      success: true,
      txSignature: signature,
      amountRefunded: escrowAmount
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Escrow Refund] ❌ Failed after ${duration}ms:`, error)

    // Extract meaningful error message
    let errorMessage = 'Unknown error during refund'
    if (error instanceof Error) {
      errorMessage = error.message

      // Add specific context for common errors
      if (error.message.includes('Insufficient funds')) {
        errorMessage = `Escrow has insufficient balance for refund`
      } else if (error.message.includes('Invalid public key')) {
        errorMessage = `Invalid wallet address provided`
      } else if (error.message.includes('Transaction simulation failed')) {
        errorMessage = `Transaction simulation failed - check escrow balance`
      } else if (error.message.includes('could not find account')) {
        errorMessage = `Escrow token account not found`
      }
    }

    return {
      success: false,
      amountRefunded: 0,
      error: errorMessage
    }
  }
}

/**
 * Validate that escrow has sufficient balance for a refund
 * 
 * @param connection - Solana connection instance
 * @param tokenMint - Token mint address to check
 * @param expectedAmount - Required amount (in tokens, not raw units)
 * @param decimals - Token decimal places
 * @returns Validation result with error if insufficient
 */
export async function validateRefundBalance(
  connection: Connection,
  tokenMint: string,
  expectedAmount: number,
  decimals: number
): Promise<{ valid: boolean; actualBalance?: number; error?: string }> {
  try {
    console.log(`[Refund Validation] Checking balance for ${tokenMint}`)
    console.log(`[Refund Validation] Expected: ${expectedAmount}`)

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

    console.log(`[Refund Validation] Token account: ${escrowTokenAccount.toString()}`)

    // Fetch balance
    const balance = await connection.getTokenAccountBalance(escrowTokenAccount)
    const actualBalance = parseFloat(balance.value.amount) / Math.pow(10, decimals)

    console.log(`[Refund Validation] Actual balance: ${actualBalance}`)

    // Validate sufficient balance
    if (actualBalance < expectedAmount) {
      const error = `Insufficient escrow balance (have ${actualBalance}, need ${expectedAmount})`
      console.error(`[Refund Validation] ❌ ${error}`)
      return {
        valid: false,
        actualBalance,
        error
      }
    }

    console.log(`[Refund Validation] ✅ Balance sufficient`)
    return {
      valid: true,
      actualBalance
    }

  } catch (error) {
    console.error('[Refund Validation] ❌ Validation failed:', error)

    let errorMessage = 'Balance validation failed'
    if (error instanceof Error) {
      errorMessage = error.message

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

