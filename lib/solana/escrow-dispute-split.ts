import {
  Connection,
  PublicKey,
  Transaction,
  Keypair
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction
} from '@solana/spl-token'
import { getFeeWallet, getFeePercentage } from '../platform-settings'
import { supabase } from '../supabase'
import bs58 from 'bs58'

/**
 * Parameters for splitting escrow between worker and poster after dispute resolution
 */
export interface DisputeSplitParams {
  /** Solana connection instance */
  connection: Connection
  /** UUID of the job */
  jobId: string
  /** UUID of the dispute */
  disputeId: string
  /** Worker's wallet address */
  workerWallet: string
  /** Poster's wallet address */
  posterWallet: string
  /** Token mint address (SPL token) */
  tokenMint: string
  /** Total amount locked in escrow (payment + fee was collected upfront) */
  escrowAmount: number
  /** Token decimal places (e.g., 9 for SOL, 6 for USDC) */
  decimals: number
  /** Percentage of (escrow - fee) to send to worker (0-100) */
  workerPercentage: number
  /** Percentage of (escrow - fee) to send to poster as refund (0-100) */
  posterPercentage: number
  /** Platform fee percentage (e.g., 5.0 for 5%) */
  feePercentage: number
}

/**
 * Result of dispute split operation
 */
export interface DisputeSplitResult {
  /** Whether the split was successful */
  success: boolean
  /** Transaction signature for worker payment (if any) */
  workerTxSignature?: string
  /** Transaction signature for poster refund (if any) */
  posterTxSignature?: string
  /** Transaction signature for fee collection */
  feeTxSignature?: string
  /** Amount received by worker (in tokens) */
  workerReceived: number
  /** Amount refunded to poster (in tokens) */
  posterRefunded: number
  /** Fee collected by platform (in tokens) */
  feeCollected: number
  /** Error message if operation failed */
  error?: string
}

/**
 * Split escrow between worker and poster based on dispute resolution percentages
 * 
 * This function distributes escrowed funds according to admin's split decision:
 * 1. Calculate platform fee from total escrow
 * 2. Calculate worker share: (escrowAmount - fee) * workerPercentage / 100
 * 3. Calculate poster refund: (escrowAmount - fee) * posterPercentage / 100
 * 4. Execute transfers to all parties
 * 
 * **Use Cases:**
 * - 100% to worker: Worker wins dispute (full payment release)
 * - 100% to poster: Poster wins dispute (full refund)
 * - 50/50 split: Compromise resolution
 * - Any other split (e.g., 75/25, 60/40)
 * 
 * **Security Requirements:**
 * - ESCROW_WALLET_PRIVATE_KEY must be in environment variables
 * - Only called from admin-verified API routes
 * 
 * **Transaction Flow:**
 * 1. Validates escrow wallet private key
 * 2. Calculates all amounts (worker, poster, fee)
 * 3. Creates ATAs if they don't exist
 * 4. Executes transfers in order: worker, poster, fee
 * 5. Logs all transactions to database
 * 
 * @param params - Split parameters
 * @returns Result with transaction signatures and amounts
 */
export async function splitEscrowForDispute(
  params: DisputeSplitParams
): Promise<DisputeSplitResult> {
  const startTime = Date.now()
  
  try {
    const {
      connection,
      jobId,
      disputeId,
      workerWallet,
      posterWallet,
      tokenMint,
      escrowAmount,
      decimals,
      workerPercentage,
      posterPercentage,
      feePercentage
    } = params

    console.log(`[Dispute Split] Starting for job ${jobId}, dispute ${disputeId}`)
    console.log(`[Dispute Split] Total escrow: ${escrowAmount}`)
    console.log(`[Dispute Split] Split: Worker ${workerPercentage}% / Poster ${posterPercentage}%`)
    console.log(`[Dispute Split] Fee: ${feePercentage}%`)

    // Validate percentages
    if (workerPercentage + posterPercentage !== 100) {
      throw new Error('Worker and poster percentages must sum to 100')
    }
    
    // Validate environment configuration
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      const error = 'ESCROW_WALLET_PRIVATE_KEY not configured in environment'
      console.error(`[Dispute Split] ${error}`)
      throw new Error(error)
    }

    // Decode escrow wallet keypair
    let escrowKeypair: Keypair
    try {
      escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
      console.log(`[Dispute Split] Escrow wallet: ${escrowKeypair.publicKey.toString()}`)
    } catch (error) {
      const message = 'Invalid escrow private key format (must be base58 encoded)'
      console.error(`[Dispute Split] ${message}`, error)
      throw new Error(message)
    }

    const escrowWalletPubkey = escrowKeypair.publicKey
    
    // Fetch fee wallet from platform settings
    const feeWalletAddress = await getFeeWallet()
    if (!feeWalletAddress) {
      throw new Error('Fee wallet not configured in platform settings')
    }
    const feeWallet = new PublicKey(feeWalletAddress)
    console.log(`[Dispute Split] Fee wallet: ${feeWallet.toString()}`)
    
    // ==================== CALCULATE AMOUNTS ====================
    
    // Platform fee is taken from total escrow first
    const feeAmount = escrowAmount * (feePercentage / 100)
    const distributableAmount = escrowAmount - feeAmount
    
    // Calculate split amounts
    const workerAmount = distributableAmount * (workerPercentage / 100)
    const posterRefundAmount = distributableAmount * (posterPercentage / 100)
    
    console.log(`[Dispute Split] Fee amount: ${feeAmount}`)
    console.log(`[Dispute Split] Distributable (after fee): ${distributableAmount}`)
    console.log(`[Dispute Split] Worker amount: ${workerAmount}`)
    console.log(`[Dispute Split] Poster refund: ${posterRefundAmount}`)
    
    // Create public keys
    const tokenMintPubkey = new PublicKey(tokenMint)
    const workerPubkey = new PublicKey(workerWallet)
    const posterPubkey = new PublicKey(posterWallet)
    
    // Get Associated Token Addresses
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      escrowWalletPubkey
    )
    
    const workerTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      workerPubkey
    )
    
    const posterTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      posterPubkey
    )
    
    const feeTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      feeWallet
    )

    console.log(`[Dispute Split] Escrow ATA: ${escrowTokenAccount.toString()}`)
    console.log(`[Dispute Split] Worker ATA: ${workerTokenAccount.toString()}`)
    console.log(`[Dispute Split] Poster ATA: ${posterTokenAccount.toString()}`)
    console.log(`[Dispute Split] Fee ATA: ${feeTokenAccount.toString()}`)
    
    // Check which token accounts exist
    const [workerAccountInfo, posterAccountInfo, feeAccountInfo] = await Promise.all([
      connection.getAccountInfo(workerTokenAccount),
      connection.getAccountInfo(posterTokenAccount),
      connection.getAccountInfo(feeTokenAccount)
    ])

    console.log(`[Dispute Split] Worker ATA exists: ${!!workerAccountInfo}`)
    console.log(`[Dispute Split] Poster ATA exists: ${!!posterAccountInfo}`)
    console.log(`[Dispute Split] Fee ATA exists: ${!!feeAccountInfo}`)
    
    let workerTxSignature: string | undefined
    let posterTxSignature: string | undefined
    let feeTxSignature: string | undefined
    
    // ==================== TRANSACTION 1: Transfer to Worker (if > 0) ====================
    
    if (workerAmount > 0) {
      console.log(`[Dispute Split] Building worker transaction...`)
      const workerTx = new Transaction()
      
      // Create worker ATA if needed
      if (!workerAccountInfo) {
        console.log(`[Dispute Split] Adding instruction to create worker ATA`)
        workerTx.add(
          createAssociatedTokenAccountInstruction(
            escrowWalletPubkey, // payer
            workerTokenAccount,
            workerPubkey,
            tokenMintPubkey
          )
        )
      }
      
      // Transfer to worker
      const workerAmountRaw = Math.floor(workerAmount * Math.pow(10, decimals))
      console.log(`[Dispute Split] Worker amount (raw): ${workerAmountRaw}`)
      
      workerTx.add(
        createTransferInstruction(
          escrowTokenAccount,
          workerTokenAccount,
          escrowWalletPubkey,
          workerAmountRaw
        )
      )
      
      // Set transaction metadata
      const { blockhash: workerBlockhash } = await connection.getLatestBlockhash('confirmed')
      workerTx.recentBlockhash = workerBlockhash
      workerTx.feePayer = escrowWalletPubkey
      
      // Sign and send worker transaction
      console.log(`[Dispute Split] Signing worker transaction...`)
      workerTx.sign(escrowKeypair)
      
      console.log(`[Dispute Split] Sending worker transaction...`)
      workerTxSignature = await connection.sendRawTransaction(
        workerTx.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' }
      )
      console.log(`[Dispute Split] Worker tx signature: ${workerTxSignature}`)
      
      console.log(`[Dispute Split] Confirming worker transaction...`)
      await connection.confirmTransaction(workerTxSignature, 'confirmed')
      console.log(`[Dispute Split] ✅ Worker payment confirmed`)
    } else {
      console.log(`[Dispute Split] Skipping worker transfer (0%)`)
    }
    
    // ==================== TRANSACTION 2: Refund to Poster (if > 0) ====================
    
    if (posterRefundAmount > 0) {
      console.log(`[Dispute Split] Building poster refund transaction...`)
      const posterTx = new Transaction()
      
      // Create poster ATA if needed
      if (!posterAccountInfo) {
        console.log(`[Dispute Split] Adding instruction to create poster ATA`)
        posterTx.add(
          createAssociatedTokenAccountInstruction(
            escrowWalletPubkey, // payer
            posterTokenAccount,
            posterPubkey,
            tokenMintPubkey
          )
        )
      }
      
      // Transfer refund to poster
      const posterAmountRaw = Math.floor(posterRefundAmount * Math.pow(10, decimals))
      console.log(`[Dispute Split] Poster refund amount (raw): ${posterAmountRaw}`)
      
      posterTx.add(
        createTransferInstruction(
          escrowTokenAccount,
          posterTokenAccount,
          escrowWalletPubkey,
          posterAmountRaw
        )
      )
      
      // Set transaction metadata
      const { blockhash: posterBlockhash } = await connection.getLatestBlockhash('confirmed')
      posterTx.recentBlockhash = posterBlockhash
      posterTx.feePayer = escrowWalletPubkey
      
      // Sign and send poster transaction
      console.log(`[Dispute Split] Signing poster refund transaction...`)
      posterTx.sign(escrowKeypair)
      
      console.log(`[Dispute Split] Sending poster refund transaction...`)
      posterTxSignature = await connection.sendRawTransaction(
        posterTx.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' }
      )
      console.log(`[Dispute Split] Poster refund tx signature: ${posterTxSignature}`)
      
      console.log(`[Dispute Split] Confirming poster refund transaction...`)
      await connection.confirmTransaction(posterTxSignature, 'confirmed')
      console.log(`[Dispute Split] ✅ Poster refund confirmed`)
    } else {
      console.log(`[Dispute Split] Skipping poster refund (0%)`)
    }
    
    // ==================== TRANSACTION 3: Transfer Fee to Platform ====================
    
    if (feeAmount > 0) {
      console.log(`[Dispute Split] Building fee transaction...`)
      const feeTx = new Transaction()
      
      // Create fee ATA if needed
      if (!feeAccountInfo) {
        console.log(`[Dispute Split] Adding instruction to create fee ATA`)
        feeTx.add(
          createAssociatedTokenAccountInstruction(
            escrowWalletPubkey,
            feeTokenAccount,
            feeWallet,
            tokenMintPubkey
          )
        )
      }
      
      // Transfer fee
      const feeAmountRaw = Math.floor(feeAmount * Math.pow(10, decimals))
      console.log(`[Dispute Split] Fee amount (raw): ${feeAmountRaw}`)
      
      feeTx.add(
        createTransferInstruction(
          escrowTokenAccount,
          feeTokenAccount,
          escrowWalletPubkey,
          feeAmountRaw
        )
      )
      
      // Set transaction metadata
      const { blockhash: feeBlockhash } = await connection.getLatestBlockhash('confirmed')
      feeTx.recentBlockhash = feeBlockhash
      feeTx.feePayer = escrowWalletPubkey
      
      // Sign and send fee transaction
      console.log(`[Dispute Split] Signing fee transaction...`)
      feeTx.sign(escrowKeypair)
      
      console.log(`[Dispute Split] Sending fee transaction...`)
      feeTxSignature = await connection.sendRawTransaction(
        feeTx.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' }
      )
      console.log(`[Dispute Split] Fee tx signature: ${feeTxSignature}`)
      
      console.log(`[Dispute Split] Confirming fee transaction...`)
      await connection.confirmTransaction(feeTxSignature, 'confirmed')
      console.log(`[Dispute Split] ✅ Fee collection confirmed`)
    }

    // ==================== LOG TRANSACTIONS TO DATABASE ====================
    
    const escrowWalletAddress = escrowWalletPubkey.toString()
    const now = new Date().toISOString()
    
    const transactions = []
    
    if (workerTxSignature && workerAmount > 0) {
      transactions.push({
        job_id: jobId,
        transaction_type: 'dispute_release_to_worker',
        from_wallet: escrowWalletAddress,
        to_wallet: workerWallet,
        amount_tokens: workerAmount,
        token_mint: tokenMint,
        token_symbol: 'TOKEN', // Will be enriched later
        tx_signature: workerTxSignature,
        status: 'confirmed',
        retry_count: 0,
        created_at: now,
        confirmed_at: now
      })
    }
    
    if (posterTxSignature && posterRefundAmount > 0) {
      transactions.push({
        job_id: jobId,
        transaction_type: 'dispute_refund_to_poster',
        from_wallet: escrowWalletAddress,
        to_wallet: posterWallet,
        amount_tokens: posterRefundAmount,
        token_mint: tokenMint,
        token_symbol: 'TOKEN',
        tx_signature: posterTxSignature,
        status: 'confirmed',
        retry_count: 0,
        created_at: now,
        confirmed_at: now
      })
    }
    
    if (feeTxSignature && feeAmount > 0) {
      transactions.push({
        job_id: jobId,
        transaction_type: 'dispute_fee_collection',
        from_wallet: escrowWalletAddress,
        to_wallet: feeWalletAddress,
        amount_tokens: feeAmount,
        token_mint: tokenMint,
        token_symbol: 'TOKEN',
        tx_signature: feeTxSignature,
        status: 'confirmed',
        retry_count: 0,
        created_at: now,
        confirmed_at: now
      })
    }
    
    if (transactions.length > 0) {
      const { error: logError } = await supabase
        .from('job_escrow_transactions')
        .insert(transactions)
      
      if (logError) {
        console.error('[Dispute Split] Failed to log transactions:', logError)
        // Don't fail - transactions are already confirmed on-chain
      } else {
        console.log(`[Dispute Split] ✅ Logged ${transactions.length} transactions to database`)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[Dispute Split] ✅ Complete in ${duration}ms`)
    
    return {
      success: true,
      workerTxSignature,
      posterTxSignature,
      feeTxSignature,
      workerReceived: workerAmount,
      posterRefunded: posterRefundAmount,
      feeCollected: feeAmount
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Dispute Split] ❌ Failed after ${duration}ms:`, error)
    
    // Extract meaningful error message
    let errorMessage = 'Unknown error during dispute split'
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Add specific context for common errors
      if (error.message.includes('Insufficient funds')) {
        errorMessage = `Escrow has insufficient balance for this split`
      } else if (error.message.includes('Invalid public key')) {
        errorMessage = `Invalid wallet address provided`
      } else if (error.message.includes('Transaction simulation failed')) {
        errorMessage = `Transaction simulation failed - check escrow balance and token accounts`
      }
    }
    
    return {
      success: false,
      workerReceived: 0,
      posterRefunded: 0,
      feeCollected: 0,
      error: errorMessage
    }
  }
}

/**
 * Validate that escrow has sufficient balance for a dispute split
 */
export async function validateDisputeSplitBalance(
  connection: Connection,
  tokenMint: string,
  expectedAmount: number,
  decimals: number
): Promise<{ valid: boolean; actualBalance?: number; error?: string }> {
  try {
    console.log(`[Dispute Split Validation] Checking balance for ${tokenMint}`)
    console.log(`[Dispute Split Validation] Expected: ${expectedAmount}`)
    
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
    
    console.log(`[Dispute Split Validation] Token account: ${escrowTokenAccount.toString()}`)
    
    // Fetch balance
    const balance = await connection.getTokenAccountBalance(escrowTokenAccount)
    const actualBalance = parseFloat(balance.value.amount) / Math.pow(10, decimals)
    
    console.log(`[Dispute Split Validation] Actual balance: ${actualBalance}`)
    
    // Validate sufficient balance
    if (actualBalance < expectedAmount) {
      const error = `Insufficient escrow balance (have ${actualBalance}, need ${expectedAmount})`
      console.error(`[Dispute Split Validation] ❌ ${error}`)
      return {
        valid: false,
        actualBalance,
        error
      }
    }
    
    console.log(`[Dispute Split Validation] ✅ Balance sufficient`)
    return { 
      valid: true,
      actualBalance
    }
    
  } catch (error) {
    console.error('[Dispute Split Validation] ❌ Validation failed:', error)
    
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

