/**
 * Signature-Based Authentication for Web3 Transactions
 * 
 * Provides secure authentication by requiring users to sign messages
 * proving wallet ownership for each sensitive action.
 * 
 * This prevents unauthorized actions and provides non-repudiation.
 */

import { verifySolanaSignature } from './solana-signature'

// Action nonces are stored in-memory with 5 minute expiry
// For production, consider Redis or database storage
const actionNonces = new Map<string, { timestamp: number; used: boolean }>()
const NONCE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const MESSAGE_MAX_AGE_MS = 2 * 60 * 1000 // 2 minutes for timestamp validation

/**
 * Clean up expired nonces (called periodically)
 */
export function cleanupExpiredActionNonces(): void {
  const now = Date.now()
  for (const [nonce, data] of actionNonces.entries()) {
    if (now - data.timestamp > NONCE_EXPIRY_MS) {
      actionNonces.delete(nonce)
    }
  }
}

// Clean up every minute
setInterval(cleanupExpiredActionNonces, 60 * 1000)

/**
 * Generate a unique nonce for an action
 */
export function generateActionNonce(): string {
  const nonce = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  actionNonces.set(nonce, { timestamp: Date.now(), used: false })
  return nonce
}

/**
 * Verify a signature for a specific action
 * 
 * @param wallet - The wallet address claiming to perform the action
 * @param signature - Base58 encoded signature
 * @param message - The signed message
 * @param actionContext - Context to validate (e.g., jobId, timestamp)
 * @returns true if signature is valid and action is authorized
 */
export interface SignatureAuthResult {
  success: boolean
  error?: string
  wallet?: string
}

export function verifyActionSignature(
  wallet: string,
  signature: string,
  message: string,
  actionContext?: {
    action?: string
    resourceId?: string
    maxAge?: number
  }
): SignatureAuthResult {
  console.log('[Signature Auth] Verifying signature...')
  console.log('  Wallet:', wallet?.slice(0, 8))
  console.log('  Signature length:', signature?.length)
  console.log('  Message length:', message?.length)
  
  // 1. Verify the cryptographic signature
  const signatureValid = verifySolanaSignature(message, signature, wallet)
  
  if (!signatureValid) {
    console.error('[Signature Auth] Invalid signature for wallet:', wallet.slice(0, 8))
    console.error('[Signature Auth] Message preview:', message?.substring(0, 150))
    return {
      success: false,
      error: 'Invalid signature - signature does not match wallet'
    }
  }

  // 2. Parse and validate message structure
  try {
    const lines = message.split('\n')
    let timestampLine: string | undefined
    let actionLine: string | undefined
    let resourceLine: string | undefined

    for (const line of lines) {
      if (line.startsWith('Timestamp:')) {
        timestampLine = line.split('Timestamp:')[1]?.trim()
      } else if (line.startsWith('Action:')) {
        actionLine = line.split('Action:')[1]?.trim()
      } else if (line.startsWith('Job ID:') || line.startsWith('Resource:')) {
        resourceLine = line.split(':')[1]?.trim()
      }
    }

    // 3. Validate timestamp (prevent replay attacks)
    if (timestampLine) {
      const timestamp = parseInt(timestampLine, 10)
      if (isNaN(timestamp)) {
        return {
          success: false,
          error: 'Invalid timestamp format'
        }
      }

      const age = Date.now() - timestamp
      const maxAge = actionContext?.maxAge || MESSAGE_MAX_AGE_MS

      if (age < 0) {
        return {
          success: false,
          error: 'Message timestamp is in the future'
        }
      }

      if (age > maxAge) {
        return {
          success: false,
          error: `Message expired (${Math.round(age / 1000)}s old, max ${Math.round(maxAge / 1000)}s)`
        }
      }
    }

    // 4. Validate action context if provided
    if (actionContext?.action && actionLine) {
      if (!actionLine.toLowerCase().includes(actionContext.action.toLowerCase())) {
        return {
          success: false,
          error: 'Message action does not match expected action'
        }
      }
    }

    if (actionContext?.resourceId && resourceLine) {
      if (resourceLine !== actionContext.resourceId) {
        return {
          success: false,
          error: 'Message resource ID does not match'
        }
      }
    }

    // All checks passed
    console.log('[Signature Auth] ✅ Valid signature for wallet:', wallet.slice(0, 8))
    return {
      success: true,
      wallet
    }

  } catch (error) {
    console.error('[Signature Auth] Error parsing message:', error)
    return {
      success: false,
      error: 'Failed to parse message structure'
    }
  }
}

/**
 * Generate a standard message for an action
 * Frontend should use this exact format for consistency
 */
export function generateActionMessage(params: {
  action: string
  resourceId?: string
  additionalInfo?: Record<string, string>
}): string {
  const lines = [
    'ALIGN Platform - Action Authorization',
    '',
    `Action: ${params.action}`,
  ]

  if (params.resourceId) {
    lines.push(`Job ID: ${params.resourceId}`)
  }

  if (params.additionalInfo) {
    for (const [key, value] of Object.entries(params.additionalInfo)) {
      lines.push(`${key}: ${value}`)
    }
  }

  lines.push(`Timestamp: ${Date.now()}`)
  lines.push('')
  lines.push('By signing this message, you authorize this action.')

  return lines.join('\n')
}

/**
 * Verify signature from request body
 * Convenience function for API routes
 */
export interface ActionAuthRequest {
  wallet: string
  signature: string
  message: string
}

export function verifyRequestSignature(
  body: ActionAuthRequest,
  actionContext?: {
    action?: string
    resourceId?: string
    maxAge?: number
  }
): SignatureAuthResult {
  const { wallet, signature, message } = body

  // Validate required fields
  if (!wallet || !signature || !message) {
    return {
      success: false,
      error: 'Missing required fields: wallet, signature, and message are required'
    }
  }

  // Verify signature
  return verifyActionSignature(wallet, signature, message, actionContext)
}

