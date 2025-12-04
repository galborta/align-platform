/**
 * Client-Side Transaction Helpers
 * 
 * Utility functions for handling Solana transactions on the frontend.
 * Includes confirmation waiting, retry logic, and display formatting.
 * 
 * @module lib/solana/client-transaction-helper
 */

import { Connection, Transaction, VersionedTransaction, Commitment } from '@solana/web3.js'

// ==================== TYPES ====================

/**
 * Transaction confirmation result
 */
export interface ConfirmationResult {
  success: boolean
  signature: string
  confirmationStatus?: Commitment
  slot?: number
  error?: string
}

/**
 * Transaction send result with retry info
 */
export interface SendResult {
  success: boolean
  signature?: string
  attempts: number
  error?: string
}

// ==================== CONFIRMATION HELPERS ====================

/**
 * Waits for transaction confirmation with retry logic
 * 
 * Polls the Solana network for transaction status until confirmed
 * or timeout is reached. Handles transient network errors gracefully.
 * 
 * @param connection - Solana connection instance
 * @param signature - Transaction signature to confirm
 * @param commitment - Confirmation level ('processed', 'confirmed', 'finalized')
 * @param timeout - Maximum time to wait in milliseconds (default: 60000)
 * @returns Promise<boolean> - true if confirmed successfully, throws on error
 * 
 * @example
 * ```typescript
 * const signature = await sendTransaction(...)
 * const confirmed = await waitForTransactionConfirmation(
 *   connection,
 *   signature,
 *   'confirmed',
 *   30000 // 30 second timeout
 * )
 * 
 * if (confirmed) {
 *   console.log('Transaction confirmed!')
 * }
 * ```
 */
export async function waitForTransactionConfirmation(
  connection: Connection,
  signature: string,
  commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
  timeout: number = 60000
): Promise<boolean> {
  const startTime = Date.now()
  const pollInterval = 2000 // 2 seconds between checks

  console.log(`[TX Confirm] Waiting for ${commitment} confirmation: ${signature.slice(0, 20)}...`)

  while (Date.now() - startTime < timeout) {
    try {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      })

      if (status?.value) {
        const { confirmationStatus, err } = status.value

        // Check for errors
        if (err) {
          const errorMsg = typeof err === 'string' ? err : JSON.stringify(err)
          console.error(`[TX Confirm] Transaction failed: ${errorMsg}`)
          throw new Error(`Transaction failed: ${errorMsg}`)
        }

        // Check confirmation level
        const confirmationLevels: Commitment[] = ['processed', 'confirmed', 'finalized']
        const requiredLevel = confirmationLevels.indexOf(commitment)
        const currentLevel = confirmationStatus 
          ? confirmationLevels.indexOf(confirmationStatus as Commitment)
          : -1

        if (currentLevel >= requiredLevel) {
          const elapsed = Date.now() - startTime
          console.log(`[TX Confirm] ✅ Confirmed (${confirmationStatus}) in ${elapsed}ms`)
          return true
        }

        console.log(`[TX Confirm] Status: ${confirmationStatus || 'pending'}, waiting for ${commitment}...`)
      }
    } catch (error: any) {
      // Don't throw on network errors, just log and retry
      if (!error.message?.includes('Transaction failed')) {
        console.warn('[TX Confirm] Network error, retrying...', error.message)
      } else {
        throw error
      }
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  const elapsed = Date.now() - startTime
  console.error(`[TX Confirm] ❌ Timeout after ${elapsed}ms`)
  throw new Error(`Transaction confirmation timeout after ${timeout}ms`)
}

/**
 * Confirms transaction using connection.confirmTransaction
 * 
 * Alternative method that uses Solana's built-in confirmation with blockhash.
 * More reliable for time-sensitive confirmations.
 * 
 * @param connection - Solana connection instance
 * @param signature - Transaction signature
 * @param blockhash - Recent blockhash used in the transaction
 * @param lastValidBlockHeight - Last valid block height for the transaction
 * @param commitment - Confirmation level
 * @returns Promise<ConfirmationResult>
 */
export async function confirmTransactionWithBlockhash(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  commitment: Commitment = 'confirmed'
): Promise<ConfirmationResult> {
  try {
    console.log(`[TX Confirm] Using blockhash confirmation for: ${signature.slice(0, 20)}...`)

    const result = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight
      },
      commitment
    )

    if (result.value.err) {
      return {
        success: false,
        signature,
        error: JSON.stringify(result.value.err)
      }
    }

    console.log(`[TX Confirm] ✅ Confirmed with blockhash method`)
    return {
      success: true,
      signature,
      confirmationStatus: commitment
    }
  } catch (error: any) {
    console.error('[TX Confirm] ❌ Blockhash confirmation failed:', error)
    return {
      success: false,
      signature,
      error: error.message
    }
  }
}

// ==================== SEND HELPERS ====================

/**
 * Sends transaction with automatic retry logic
 * 
 * Attempts to send a transaction multiple times with exponential backoff
 * on transient failures. Useful for handling network congestion.
 * 
 * @param connection - Solana connection instance
 * @param transaction - Signed transaction to send
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<SendResult> - Result with signature or error
 * 
 * @example
 * ```typescript
 * const result = await sendTransactionWithRetry(connection, signedTx, 3)
 * 
 * if (result.success) {
 *   console.log('Sent in', result.attempts, 'attempts:', result.signature)
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error)
 * }
 * ```
 */
export async function sendTransactionWithRetry(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  maxRetries: number = 3
): Promise<SendResult> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TX Send] Attempt ${attempt}/${maxRetries}...`)

      // Serialize based on transaction type
      const serialized = transaction instanceof Transaction
        ? transaction.serialize()
        : transaction.serialize()

      const signature = await connection.sendRawTransaction(serialized, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 0 // We handle retries ourselves
      })

      console.log(`[TX Send] ✅ Sent on attempt ${attempt}: ${signature.slice(0, 20)}...`)
      return {
        success: true,
        signature,
        attempts: attempt
      }
    } catch (error: any) {
      console.error(`[TX Send] Attempt ${attempt} failed:`, error.message)
      lastError = error

      // Check if error is retryable
      const isRetryable = isRetryableError(error.message)
      
      if (!isRetryable) {
        console.error('[TX Send] Non-retryable error, aborting')
        break
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const backoff = 1000 * Math.pow(2, attempt - 1)
        console.log(`[TX Send] Waiting ${backoff}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
      }
    }
  }

  return {
    success: false,
    attempts: maxRetries,
    error: lastError?.message || 'Failed to send transaction'
  }
}

/**
 * Determines if an error is transient and should be retried
 */
function isRetryableError(errorMessage: string): boolean {
  if (!errorMessage) return false
  
  const lower = errorMessage.toLowerCase()
  
  // Retryable errors
  const retryablePatterns = [
    'blockhash not found',
    'blockhash expired',
    'network error',
    'timeout',
    'timed out',
    'connection',
    'rate limit',
    '429',
    'too many requests',
    'node is unhealthy',
    'server error',
    '503',
    '502'
  ]
  
  // Non-retryable errors
  const nonRetryablePatterns = [
    'insufficient funds',
    'insufficient balance',
    'invalid signature',
    'signature verification failed',
    'account not found',
    'instruction error'
  ]
  
  // Check non-retryable first
  if (nonRetryablePatterns.some(p => lower.includes(p))) {
    return false
  }
  
  return retryablePatterns.some(p => lower.includes(p))
}

// ==================== FORMATTING HELPERS ====================

/**
 * Formats transaction signature for display
 * 
 * @param signature - Full transaction signature
 * @param length - Number of characters to show on each end (default: 8)
 * @returns Formatted signature like "5xyz1234...cdefgh12"
 * 
 * @example
 * formatSignature('5xyz12345678901234567890abcdefgh12345678901234567890')
 * // Returns: "5xyz1234...01234567"
 */
export function formatSignature(signature: string, length: number = 8): string {
  if (!signature) return 'N/A'
  if (signature.length <= length * 2 + 3) return signature
  return `${signature.slice(0, length)}...${signature.slice(-length)}`
}

/**
 * Formats wallet address for display
 * 
 * @param address - Full wallet address
 * @param length - Number of characters to show on each end (default: 4)
 * @returns Formatted address like "5xyz...gh12"
 */
export function formatWalletAddress(address: string, length: number = 4): string {
  if (!address) return 'N/A'
  if (address.length <= length * 2 + 3) return address
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

/**
 * Gets Solana Explorer URL for a transaction
 * 
 * @param signature - Transaction signature
 * @param cluster - Solana cluster (default: 'mainnet-beta')
 * @returns Full Solana Explorer URL
 * 
 * @example
 * getExplorerUrl('5xyz...', 'devnet')
 * // Returns: "https://explorer.solana.com/tx/5xyz...?cluster=devnet"
 */
export function getExplorerUrl(
  signature: string,
  cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'
): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`
}

/**
 * Gets Solana Explorer URL for a wallet address
 * 
 * @param address - Wallet address
 * @param cluster - Solana cluster (default: 'mainnet-beta')
 * @returns Full Solana Explorer URL for the address
 */
export function getAddressExplorerUrl(
  address: string,
  cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'
): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://explorer.solana.com/address/${address}${clusterParam}`
}

/**
 * Gets Solscan URL for a transaction (alternative explorer)
 * 
 * @param signature - Transaction signature
 * @param cluster - Solana cluster
 * @returns Solscan URL
 */
export function getSolscanUrl(
  signature: string,
  cluster: 'mainnet-beta' | 'devnet' = 'mainnet-beta'
): string {
  const subdomain = cluster === 'devnet' ? 'devnet.' : ''
  return `https://${subdomain}solscan.io/tx/${signature}`
}

// ==================== UTILITY HELPERS ====================

/**
 * Converts lamports to SOL
 * 
 * @param lamports - Amount in lamports
 * @returns Amount in SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

/**
 * Converts SOL to lamports
 * 
 * @param sol - Amount in SOL
 * @returns Amount in lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000)
}

/**
 * Formats token amount for display
 * 
 * @param amount - Amount in smallest units
 * @param decimals - Token decimals (default: 9 for SOL)
 * @param displayDecimals - Decimals to show in output (default: 4)
 * @returns Formatted amount string
 */
export function formatTokenAmount(
  amount: number,
  decimals: number = 9,
  displayDecimals: number = 4
): string {
  const value = amount / Math.pow(10, decimals)
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals
  })
}

/**
 * Gets current Solana cluster from environment
 * 
 * @returns Detected cluster based on RPC URL
 */
export function getCurrentCluster(): 'mainnet-beta' | 'devnet' | 'testnet' {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || ''
  
  if (rpcUrl.includes('devnet')) return 'devnet'
  if (rpcUrl.includes('testnet')) return 'testnet'
  return 'mainnet-beta'
}

