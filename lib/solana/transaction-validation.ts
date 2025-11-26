import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { checkAtaExists, estimateAtaCost } from './ata-utils'

/**
 * Result of transaction validation
 */
export interface ValidationResult {
  valid: boolean
  error?: string
  estimatedCost?: {
    tokens: number
    sol: number
    ataNeeded: boolean
  }
}

/**
 * Validate a tip transaction before attempting to send
 * 
 * Performs pre-flight checks:
 * 1. Validates recipient address
 * 2. Checks sender token balance
 * 3. Checks sender SOL balance for fees
 * 4. Checks if recipient ATA exists
 * 5. Estimates total costs
 * 
 * @param connection - Solana connection
 * @param senderWallet - Sender's public key
 * @param recipientWallet - Recipient's wallet address (string)
 * @param tokenMint - Token mint address (string)
 * @param amount - Amount to send (in token units, not lamports)
 * @param decimals - Token decimals
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = await validateTipTransaction(
 *   connection,
 *   senderPublicKey,
 *   'recipient...',
 *   'mint...',
 *   10.5,
 *   9
 * )
 * 
 * if (!result.valid) {
 *   toast.error(result.error)
 *   return
 * }
 * 
 * console.log(`Total SOL needed: ${result.estimatedCost.sol}`)
 * ```
 */
export async function validateTipTransaction(
  connection: Connection,
  senderWallet: PublicKey,
  recipientWallet: string,
  tokenMint: string,
  amount: number,
  decimals: number
): Promise<ValidationResult> {
  try {
    // 1. Validate recipient address
    let recipientPubkey: PublicKey
    try {
      recipientPubkey = new PublicKey(recipientWallet)
    } catch {
      return {
        valid: false,
        error: 'Invalid recipient wallet address'
      }
    }

    // 2. Check sender token balance
    const mintPubkey = new PublicKey(tokenMint)
    const senderAta = await getAssociatedTokenAddress(
      mintPubkey,
      senderWallet,
      false,
      TOKEN_PROGRAM_ID
    )

    let senderBalanceUi = 0
    try {
      const senderBalance = await connection.getTokenAccountBalance(senderAta)
      senderBalanceUi = senderBalance.value.uiAmount || 0
    } catch (error) {
      // If token account doesn't exist, balance is 0
      console.warn('Sender token account not found:', error)
      senderBalanceUi = 0
    }

    if (senderBalanceUi < amount) {
      return {
        valid: false,
        error: `Insufficient token balance. You have ${senderBalanceUi.toFixed(4)} tokens`
      }
    }

    // 3. Check sender SOL balance
    const solBalance = await connection.getBalance(senderWallet)
    const solBalanceUi = solBalance / LAMPORTS_PER_SOL

    // 4. Check if recipient ATA exists
    const ataNeeded = !(await checkAtaExists(connection, recipientPubkey, mintPubkey))

    // 5. Estimate costs
    const baseFee = 0.000005 // ~5000 lamports for transfer
    const ataCost = ataNeeded ? estimateAtaCost() : 0
    const totalSolNeeded = baseFee + ataCost

    if (solBalanceUi < totalSolNeeded) {
      const ataNote = ataNeeded ? ' (includes ~0.002 SOL for creating recipient token account)' : ''
      return {
        valid: false,
        error: `Insufficient SOL for transaction fees. Need ${totalSolNeeded.toFixed(6)} SOL, you have ${solBalanceUi.toFixed(6)} SOL${ataNote}`
      }
    }

    // All checks passed
    return {
      valid: true,
      estimatedCost: {
        tokens: amount,
        sol: totalSolNeeded,
        ataNeeded
      }
    }

  } catch (error: any) {
    console.error('Validation error:', error)
    return {
      valid: false,
      error: 'Unable to validate transaction. Please try again.'
    }
  }
}

/**
 * Quick check if wallet has minimum SOL for any transaction
 * 
 * @param connection - Solana connection
 * @param wallet - Wallet public key
 * @param minSol - Minimum SOL required (default: 0.001)
 * @returns True if wallet has sufficient SOL
 */
export async function checkMinimumSol(
  connection: Connection,
  wallet: PublicKey,
  minSol: number = 0.001
): Promise<boolean> {
  try {
    const balance = await connection.getBalance(wallet)
    const balanceUi = balance / LAMPORTS_PER_SOL
    return balanceUi >= minSol
  } catch (error) {
    console.error('Error checking SOL balance:', error)
    return false
  }
}


