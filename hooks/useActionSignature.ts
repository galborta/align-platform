/**
 * Hook for signing Web3 action messages
 * 
 * Provides utilities to sign messages proving wallet ownership
 * for sensitive actions like job cancellations, payments, etc.
 */

import { useWallet } from '@solana/wallet-adapter-react'
import { useCallback } from 'react'
import bs58 from 'bs58'

export interface SignedAction {
  wallet: string
  signature: string
  message: string
}

export interface ActionSignatureParams {
  action: string
  resourceId?: string
  additionalInfo?: Record<string, string>
}

/**
 * Generate a standard action message
 */
function generateActionMessage(params: ActionSignatureParams): string {
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

export function useActionSignature() {
  const { publicKey, signMessage } = useWallet()

  /**
   * Sign a message proving authorization for an action
   * 
   * @param params - Action parameters
   * @returns Signed action data to send to API
   * @throws Error if wallet not connected or user rejects signature
   */
  const signAction = useCallback(async (
    params: ActionSignatureParams
  ): Promise<SignedAction> => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected')
    }

    // Generate the message
    const message = generateActionMessage(params)
    
    console.log('[useActionSignature] Generating signature:')
    console.log('  Wallet (publicKey):', publicKey.toBase58())
    console.log('  Message preview:', message.substring(0, 200))

    // Request signature from wallet
    try {
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = bs58.encode(signatureBytes)
      
      console.log('[useActionSignature] Signature generated:')
      console.log('  Signature length:', signature.length)
      console.log('  Signature:', signature)

      return {
        wallet: publicKey.toBase58(),
        signature,
        message
      }
    } catch (error) {
      // User rejected signature or wallet error
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()
        if (
          errorMsg.includes('rejected') ||
          errorMsg.includes('cancelled') ||
          errorMsg.includes('user denied')
        ) {
          throw new Error('Signature request cancelled by user')
        }
      }
      throw new Error('Failed to sign message')
    }
  }, [publicKey, signMessage])

  return {
    signAction,
    isReady: !!publicKey && !!signMessage
  }
}

