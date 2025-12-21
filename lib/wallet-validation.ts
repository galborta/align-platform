import { PublicKey } from '@solana/web3.js'

/**
 * Validate a Solana wallet address format
 * 
 * @param address - The wallet address to validate
 * @returns true if valid Solana address, false otherwise
 * 
 * @example
 * isValidSolanaAddress('7xK9...') // true
 * isValidSolanaAddress('invalid') // false
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false
  }

  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Result of wallet validation
 */
export interface WalletValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Error message if validation failed */
  error?: string
  /** The specific wallet that caused validation to fail */
  invalidWallet?: string
}

/**
 * Options for validating editor wallets
 */
export interface ValidateEditorWalletsOptions {
  /** Creator's wallet address (will be excluded from editor list) */
  creatorWallet?: string
  /** Existing editors (to check for duplicates) */
  existingEditors?: string[]
  /** Maximum number of editors allowed (default: 20) */
  maxEditors?: number
}

/**
 * Validate an array of editor wallet addresses
 * 
 * Performs comprehensive validation:
 * - Checks if input is an array
 * - Enforces maximum editor limit
 * - Detects duplicate addresses
 * - Prevents adding creator as editor
 * - Validates Solana address format
 * 
 * @param wallets - Array of wallet addresses to validate
 * @param options - Validation options (creator, existing editors, max limit)
 * @returns Validation result with error details if failed
 * 
 * @example
 * validateEditorWallets(['7xK9...'], { creatorWallet: '8yL2...' })
 * // { valid: true }
 * 
 * validateEditorWallets(['invalid'], {})
 * // { valid: false, error: 'Invalid Solana wallet...', invalidWallet: 'invalid' }
 */
export function validateEditorWallets(
  wallets: string[],
  options: ValidateEditorWalletsOptions = {}
): WalletValidationResult {
  const {
    creatorWallet,
    existingEditors = [],
    maxEditors = 20
  } = options

  // Check it's an array
  if (!Array.isArray(wallets)) {
    return {
      valid: false,
      error: 'Editor wallets must be an array'
    }
  }

  // Empty array is valid (no editors)
  if (wallets.length === 0) {
    return { valid: true }
  }

  // Check max limit (including existing editors)
  const totalEditors = existingEditors.length + wallets.length
  if (totalEditors > maxEditors) {
    return {
      valid: false,
      error: `Maximum ${maxEditors} editors allowed (currently ${existingEditors.length}, trying to add ${wallets.length})`
    }
  }

  // Check for duplicates within input
  const uniqueWallets = new Set(wallets)
  if (uniqueWallets.size !== wallets.length) {
    return {
      valid: false,
      error: 'Duplicate wallet addresses in list'
    }
  }

  // Check for duplicates with existing editors
  for (const wallet of wallets) {
    if (existingEditors.includes(wallet)) {
      return {
        valid: false,
        error: 'Wallet already added as editor',
        invalidWallet: wallet
      }
    }
  }

  // Check creator not in list
  if (creatorWallet && wallets.includes(creatorWallet)) {
    return {
      valid: false,
      error: 'Creator cannot be added as editor (already has full access)',
      invalidWallet: creatorWallet
    }
  }

  // Check for empty strings
  for (const wallet of wallets) {
    if (typeof wallet !== 'string' || !wallet.trim()) {
      return {
        valid: false,
        error: 'Wallet address cannot be empty',
        invalidWallet: wallet
      }
    }
  }

  // Validate each wallet format
  for (const wallet of wallets) {
    if (!isValidSolanaAddress(wallet)) {
      return {
        valid: false,
        error: 'Invalid Solana wallet address format',
        invalidWallet: wallet
      }
    }
  }

  return { valid: true }
}

/**
 * Truncate wallet address for display
 * 
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 4)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address in format "7xK9...mP4j"
 * 
 * @example
 * truncateAddress('7xK9abcdefghijklmnopqrstuvwxyz1234mP4j')
 * // "7xK9...mP4j"
 * 
 * truncateAddress('7xK9abcdefghijklmnopqrstuvwxyz1234mP4j', 6, 6)
 * // "7xK9ab...34mP4j"
 */
export function truncateAddress(
  address: string,
  startChars = 4,
  endChars = 4
): string {
  if (!address || address.length <= startChars + endChars) {
    return address
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Project type for editor permission checks
 */
export interface ProjectWithEditors {
  /** Creator's wallet address */
  creator_wallet: string
  /** Array of editor wallet addresses */
  editor_wallets: string[]
}

/**
 * Check if wallet has editor or creator permissions for a project
 * 
 * @param wallet - Wallet address to check
 * @param project - Project with creator_wallet and editor_wallets
 * @returns true if wallet is creator OR in editor_wallets array
 * 
 * @example
 * isEditorOrCreator('7xK9...', { 
 *   creator_wallet: '7xK9...', 
 *   editor_wallets: []
 * })
 * // true (is creator)
 * 
 * isEditorOrCreator('8yL2...', { 
 *   creator_wallet: '7xK9...', 
 *   editor_wallets: ['8yL2...']
 * })
 * // true (is editor)
 * 
 * isEditorOrCreator('9zM3...', { 
 *   creator_wallet: '7xK9...', 
 *   editor_wallets: ['8yL2...']
 * })
 * // false (neither)
 */
export function isEditorOrCreator(
  wallet: string,
  project: ProjectWithEditors
): boolean {
  if (!wallet || !project) {
    return false
  }

  return (
    wallet === project.creator_wallet ||
    (Array.isArray(project.editor_wallets) && project.editor_wallets.includes(wallet))
  )
}

/**
 * Check if wallet is the project creator
 * 
 * @param wallet - Wallet address to check
 * @param project - Project with creator_wallet
 * @returns true if wallet is the creator
 * 
 * @example
 * isCreator('7xK9...', { creator_wallet: '7xK9...', editor_wallets: [] })
 * // true
 */
export function isCreator(
  wallet: string,
  project: ProjectWithEditors
): boolean {
  if (!wallet || !project) {
    return false
  }

  return wallet === project.creator_wallet
}

/**
 * Check if wallet is an editor (not creator)
 * 
 * @param wallet - Wallet address to check
 * @param project - Project with editor_wallets
 * @returns true if wallet is in editor_wallets (but not creator)
 * 
 * @example
 * isEditor('8yL2...', { 
 *   creator_wallet: '7xK9...', 
 *   editor_wallets: ['8yL2...']
 * })
 * // true (is editor, not creator)
 */
export function isEditor(
  wallet: string,
  project: ProjectWithEditors
): boolean {
  if (!wallet || !project) {
    return false
  }

  return (
    wallet !== project.creator_wallet &&
    Array.isArray(project.editor_wallets) &&
    project.editor_wallets.includes(wallet)
  )
}

/**
 * Format wallet address for display with optional label
 * 
 * @param address - Full wallet address
 * @param label - Optional label (e.g., "Creator", "Editor")
 * @returns Formatted display string
 * 
 * @example
 * formatWalletDisplay('7xK9...mP4j', 'Creator')
 * // "7xK9...mP4j (Creator)"
 * 
 * formatWalletDisplay('7xK9...mP4j')
 * // "7xK9...mP4j"
 */
export function formatWalletDisplay(
  address: string,
  label?: string
): string {
  const truncated = truncateAddress(address)
  return label ? `${truncated} (${label})` : truncated
}

