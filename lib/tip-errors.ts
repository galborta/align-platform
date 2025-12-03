/**
 * TipModal Error Messages and Constants
 * Centralized error messages for easy updates and consistency
 */

export const TIP_ERROR_MESSAGES = {
  // Wallet errors
  WALLET_DISCONNECTED: 'Wallet disconnected. Please reconnect to continue.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet to send tips.',
  WALLET_SIGNATURE_REJECTED: 'Transaction cancelled by user',
  
  // Balance errors
  INSUFFICIENT_BALANCE: 'Insufficient token balance',
  INSUFFICIENT_SOL: 'Insufficient SOL for transaction fee (~0.001 SOL needed)',
  ZERO_BALANCE_WARNING: 'You are sending your entire balance. No tokens will remain after this tip.',
  
  // Token errors
  NO_TOKENS_AVAILABLE: 'No tokens available to send (minimum $0.10 value required)',
  TOKEN_PRICE_UNAVAILABLE: 'Token price unavailable. USD value and karma rewards may be limited.',
  TOKEN_ACCOUNT_ERROR: 'Failed to create token account for recipient',
  
  // Validation errors
  INVALID_AMOUNT: 'Please enter a valid amount',
  AMOUNT_TOO_SMALL: 'Amount too small to send',
  AMOUNT_REQUIRED: 'Please enter an amount greater than 0',
  RECIPIENT_SAME_AS_SENDER: 'You cannot tip yourself',
  
  // Transaction errors
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  TRANSACTION_TIMEOUT: 'Transaction timed out. It may still succeed - check your wallet.',
  TRANSACTION_ALREADY_PROCESSED: 'A transaction is already being processed',
  BLOCKHASH_NOT_FOUND: 'Network error. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  
  // Database errors
  RECORDING_FAILED: 'Tip sent! (Recording delayed - karma will be awarded soon)',
  RECORDING_TIMEOUT: 'Tip sent successfully! Karma recording in progress...',
  
  // Retry messages
  RETRYING: 'Retrying...',
  MAX_RETRIES_REACHED: 'Max retries reached. Please try again later.',
  
  // General errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  PLEASE_TRY_AGAIN: 'Failed to send tip. Please try again.',
  
  // Warnings
  CONCURRENT_TIP_WARNING: 'Please wait for current tip to complete before sending another',
  CONFIRMATION_PENDING: 'Transaction sent but confirmation timed out.',
  
  // Success
  TIP_SENT_SUCCESS: 'Tip sent successfully!',
  TIP_SENT_WITH_KARMA: 'Tip sent! You earned {karma} karma',
} as const

export const TIP_WARNING_MESSAGES = {
  PRICE_UNAVAILABLE: '⚠️ Token price unavailable. Tip will be sent but USD value and karma may be limited.',
  ENTIRE_BALANCE: '⚠️ You are about to send your entire balance. You will have 0 {symbol} remaining.',
  SLOW_NETWORK: '⚠️ Network is slow. This may take longer than usual.',
} as const

export const TIP_LOADING_MESSAGES = {
  VALIDATING: 'Validating...',
  CREATING_TRANSACTION: 'Creating transaction...',
  AWAITING_SIGNATURE: 'Awaiting signature...',
  CONFIRMING: 'Confirming...',
  RECORDING_TIP: 'Recording tip...',
  CHECKING_STATUS: 'Checking status...',
} as const

export const TIP_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2, // Exponential: 1s, 2s, 4s
  CONFIRMATION_TIMEOUT: 60000, // 60 seconds
} as const

export const TIP_VALIDATION = {
  MIN_USD_VALUE: 0.10,
  MAX_MESSAGE_LENGTH: 200,
  DAILY_KARMA_CAP: 5000,
} as const






