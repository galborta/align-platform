import { NextResponse } from 'next/server'
import { requireVerifiedWallet } from './requireVerifiedWallet'

/**
 * Higher-order middleware that checks wallet verification and returns
 * a NextResponse error if not verified.
 * 
 * Use this in API routes for convenience:
 * 
 * @example
 * ```typescript
 * const verificationCheck = await withVerifiedWallet(walletAddress)
 * if (verificationCheck) return verificationCheck // Returns error response
 * 
 * // Continue with verified wallet logic
 * ```
 * 
 * @param walletAddress - The wallet address to verify
 * @returns NextResponse with 403 error if not verified, null if verified
 */
export async function withVerifiedWallet(
  walletAddress: string
): Promise<NextResponse | null> {
  const { verified, error } = await requireVerifiedWallet(walletAddress)

  if (!verified) {
    return NextResponse.json(
      { error: error || 'Wallet verification required' },
      { status: 403 }
    )
  }

  return null
}

