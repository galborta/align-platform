/**
 * Wallet Address Utilities
 * 
 * Helper functions for formatting and displaying Solana wallet addresses
 */

/**
 * Truncates a wallet address to show only first and last characters
 * 
 * @param address - Full Solana wallet address
 * @param chars - Number of characters to show on each end (default: 4)
 * @returns Truncated address in format "5xK3...m9P2"
 * 
 * @example
 * ```typescript
 * truncateWalletAddress('5xK3abc123def456m9P2', 4)
 * // Returns: '5xK3...m9P2'
 * 
 * truncateWalletAddress('5xK3abc123def456m9P2', 6)
 * // Returns: '5xK3ab...f456m9P2'
 * ```
 */
export function truncateWalletAddress(address: string, chars: number = 4): string {
  if (!address) return ''
  if (address.length <= chars * 2) return address
  
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/**
 * Format wallet address for display with copy functionality
 * 
 * @param address - Full wallet address
 * @returns Object with full address and truncated version
 */
export function formatWalletDisplay(address: string) {
  return {
    full: address,
    truncated: truncateWalletAddress(address),
    short: truncateWalletAddress(address, 6)
  }
}

/**
 * Validate Solana wallet address format
 * 
 * @param address - Address to validate
 * @returns True if address appears to be valid Solana format
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false
  
  // Solana addresses are base58 encoded, typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  return base58Regex.test(address)
}

