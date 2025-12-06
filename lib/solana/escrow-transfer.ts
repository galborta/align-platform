import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { getEscrowWallet } from '../platform-settings'

// Memo Program ID (SPL Memo Program)
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

/**
 * Parameters for transferring tokens to escrow
 */
export interface EscrowTransferParams {
  /** Solana RPC connection */
  connection: Connection
  /** Sender's wallet public key */
  senderWallet: PublicKey
  /** SPL token mint address */
  tokenMint: PublicKey
  /** Token amount (including escrow + fee) */
  amount: number
  /** Token decimals (usually 9 for most SPL tokens) */
  decimals: number
  /** Token symbol for display (e.g., 'NUB') */
  tokenSymbol?: string
  /** Job title for transaction description */
  jobTitle?: string
  /** Worker payment amount (before fees) */
  workerPayment?: number
}

/**
 * Result of escrow transfer operation
 */
export interface EscrowTransferResult {
  /** Whether the transfer succeeded */
  success: boolean
  /** Transaction signature if successful */
  signature?: string
  /** Error message if failed */
  error?: string
  /** Escrow wallet address that received the tokens */
  escrowWallet: string
}

/**
 * Transfer SPL tokens to platform escrow wallet
 * 
 * This function handles the complete flow of transferring tokens to escrow:
 * 1. Fetches escrow wallet address from platform settings
 * 2. Checks if escrow has an Associated Token Account (ATA) for this token
 * 3. Creates ATA if needed (sender pays rent ~0.002 SOL)
 * 4. Transfers tokens from sender to escrow
 * 5. Waits for transaction confirmation
 * 
 * @param params - Transfer parameters including connection, wallets, and amount
 * @param sendTransaction - Function to send the transaction (from wallet adapter)
 * @returns Promise with transfer result including signature or error
 * 
 * @example
 * ```typescript
 * const result = await transferToEscrow(
 *   {
 *     connection,
 *     senderWallet: publicKey,
 *     tokenMint: new PublicKey('So11111...'),
 *     amount: 105, // 100 payment + 5 fee
 *     decimals: 9
 *   },
 *   sendTransaction
 * )
 * 
 * if (result.success) {
 *   console.log('Transfer signature:', result.signature)
 * } else {
 *   console.error('Transfer failed:', result.error)
 * }
 * ```
 */
export async function transferToEscrow(
  params: EscrowTransferParams,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<EscrowTransferResult> {
  try {
    const { connection, senderWallet, tokenMint, amount, decimals, tokenSymbol, jobTitle, workerPayment } = params
    
    // Get escrow wallet from platform settings
    const escrowWalletAddress = await getEscrowWallet()
    
    if (!escrowWalletAddress) {
      return {
        success: false,
        error: 'Escrow wallet not configured in platform settings',
        escrowWallet: ''
      }
    }

    const escrowWallet = new PublicKey(escrowWalletAddress)
    
    // Get sender's token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      senderWallet,
      false,
      TOKEN_PROGRAM_ID
    )
    
    // Get escrow's token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowWallet,
      false,
      TOKEN_PROGRAM_ID
    )
    
    // Check if escrow ATA exists
    const escrowAccountInfo = await connection.getAccountInfo(escrowTokenAccount)
    
    // Build transaction
    const transaction = new Transaction()
    
    // Add ATA creation if needed (sender pays rent ~0.002 SOL)
    if (!escrowAccountInfo) {
      console.log('Creating ATA for escrow wallet (one-time cost ~0.002 SOL)')
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderWallet,        // payer (sender pays the rent)
          escrowTokenAccount,  // ata address
          escrowWallet,        // ata owner (escrow wallet)
          tokenMint,           // token mint
          TOKEN_PROGRAM_ID
        )
      )
    }
    
    // Calculate transfer amount with decimals
    const transferAmount = Math.floor(amount * Math.pow(10, decimals))
    
    if (transferAmount <= 0) {
      return {
        success: false,
        error: 'Invalid transfer amount (must be greater than 0)',
        escrowWallet: escrowWalletAddress
      }
    }
    
    // Create descriptive memo for wallet display
    const symbol = tokenSymbol || 'tokens'
    const workerAmount = workerPayment || amount
    const titleText = jobTitle ? ` for "${jobTitle.slice(0, 40)}${jobTitle.length > 40 ? '...' : ''}"` : ''
    const memoText = `🔒 Lock ${amount.toFixed(2)} ${symbol} in escrow${titleText} (${workerAmount.toFixed(2)} ${symbol} to worker + fees)`
    
    // Add memo instruction BEFORE transfer for better visibility in wallet
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, 'utf-8')
    })
    transaction.add(memoInstruction)
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,  // from
        escrowTokenAccount,  // to
        senderWallet,        // owner
        transferAmount,      // amount (with decimals)
        [],                  // multisig signers (none)
        TOKEN_PROGRAM_ID
      )
    )
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = senderWallet
    
    // Send transaction using wallet adapter's sendTransaction
    // This allows Phantom to simulate and show balance changes before signing
    const signature = await sendTransaction(transaction, connection)
    
    console.log('Escrow transfer sent:', signature)
    
    // Confirm transaction with timeout
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight
      },
      'confirmed'
    )
    
    if (confirmation.value.err) {
      // Parse common SPL Token error codes for user-friendly messages
      const errStr = JSON.stringify(confirmation.value.err)
      let userFriendlyError = 'Transaction failed on-chain'
      
      // Custom:1 = InsufficientFunds in SPL Token program
      if (errStr.includes('"Custom":1') || errStr.includes('"Custom": 1')) {
        userFriendlyError = 'Insufficient token balance. Please check that you have enough tokens in your wallet.'
      }
      // Custom:0 = NotRentExempt
      else if (errStr.includes('"Custom":0') || errStr.includes('"Custom": 0')) {
        userFriendlyError = 'Insufficient SOL for account rent. Please add more SOL to your wallet.'
      }
      // Custom:4 = OwnerMismatch
      else if (errStr.includes('"Custom":4') || errStr.includes('"Custom": 4')) {
        userFriendlyError = 'Token account owner mismatch. Please try again or contact support.'
      }
      
      console.error('Transaction failed with error:', confirmation.value.err)
      
      return {
        success: false,
        error: userFriendlyError,
        escrowWallet: escrowWalletAddress
      }
    }
    
    console.log('Escrow transfer confirmed:', signature)
    
    return {
      success: true,
      signature,
      escrowWallet: escrowWalletAddress
    }
    
  } catch (error: any) {
    console.error('Escrow transfer failed:', error)
    
    // Provide user-friendly error messages
    let errorMessage = 'Unknown error occurred'
    
    if (error.message?.includes('User rejected')) {
      errorMessage = 'Transaction was rejected by user'
    } else if (error.message?.includes('Insufficient funds')) {
      errorMessage = 'Insufficient SOL for transaction fees'
    } else if (error.message?.includes('insufficient lamports')) {
      errorMessage = 'Insufficient SOL for transaction fees and rent'
    } else if (error.message?.includes('custom program error')) {
      errorMessage = 'Insufficient token balance or invalid token account'
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage,
      escrowWallet: ''
    }
  }
}

/**
 * Validate that wallet has sufficient tokens and SOL for escrow transfer
 * 
 * Checks:
 * 1. SOL balance >= 0.01 SOL (for transaction fees + potential ATA creation)
 * 2. Token account exists for this mint
 * 3. Token balance >= required amount
 * 
 * @param connection - Solana RPC connection
 * @param walletAddress - User's wallet public key
 * @param tokenMint - SPL token mint address
 * @param amount - Required token amount (including fee)
 * @param decimals - Token decimals
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const validation = await validateEscrowTransfer(
 *   connection,
 *   publicKey,
 *   new PublicKey('So11111...'),
 *   105, // 100 payment + 5 fee
 *   9
 * )
 * 
 * if (!validation.valid) {
 *   toast.error(validation.error)
 *   return
 * }
 * ```
 */
export async function validateEscrowTransfer(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMint: PublicKey,
  amount: number,
  decimals: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check SOL balance (need at least 0.01 SOL for transaction + ATA creation)
    const solBalance = await connection.getBalance(walletAddress)
    const minSolRequired = 0.01 * LAMPORTS_PER_SOL
    
    if (solBalance < minSolRequired) {
      const currentSol = (solBalance / LAMPORTS_PER_SOL).toFixed(4)
      return {
        valid: false,
        error: `Insufficient SOL for transaction fees. Need at least 0.01 SOL, you have ${currentSol} SOL`
      }
    }
    
    // Get token account
    const tokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletAddress,
      false,
      TOKEN_PROGRAM_ID
    )
    
    // Check if token account exists
    const accountInfo = await connection.getAccountInfo(tokenAccount)
    if (!accountInfo) {
      return {
        valid: false,
        error: 'No token account found. You may need to receive some tokens first.'
      }
    }
    
    // Parse token account balance
    try {
      const tokenAmount = await connection.getTokenAccountBalance(tokenAccount)
      const rawBalance = parseFloat(tokenAmount.value.amount)
      const balance = rawBalance / Math.pow(10, decimals)
      
      if (balance < amount) {
        return {
          valid: false,
          error: `Insufficient token balance. You have ${balance.toFixed(2)} but need ${amount.toFixed(2)}`
        }
      }
    } catch (balanceError) {
      return {
        valid: false,
        error: 'Unable to fetch token balance. Please try again.'
      }
    }
    
    return { valid: true }
    
  } catch (error: any) {
    console.error('Validation error:', error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }
  }
}

/**
 * Calculate escrow amount including platform fee
 * 
 * Formula: escrowAmount = jobPayment + (jobPayment × feePercentage / 100)
 * 
 * @param jobPayment - Base payment for the job
 * @param feePercentage - Platform fee percentage (e.g., 5 for 5%)
 * @returns Total amount to lock in escrow
 * 
 * @example
 * ```typescript
 * const escrowAmount = calculateEscrowAmount(100, 5)
 * // Returns: 105 (100 payment + 5 fee)
 * ```
 */
export function calculateEscrowAmount(
  jobPayment: number,
  feePercentage: number
): number {
  const fee = jobPayment * (feePercentage / 100)
  return jobPayment + fee
}

