import { supabaseAdmin } from '@/lib/supabase'

/**
 * Middleware helper to check if a wallet is verified
 * Used in API routes to enforce wallet verification requirements
 * 
 * @param walletAddress - The wallet address to verify
 * @returns Object with verified status and optional error message
 */
export async function requireVerifiedWallet(walletAddress: string) {
  const supabase = supabaseAdmin

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('wallet_verified')
    .eq('wallet_address', walletAddress)
    .single()

  if (!profile?.wallet_verified) {
    return {
      verified: false,
      error: 'Wallet verification required'
    }
  }

  return { verified: true }
}

