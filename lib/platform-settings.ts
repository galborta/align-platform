import { supabase } from './supabase'

/**
 * Get platform fee percentage
 */
export async function getFeePercentage(): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('get_platform_setting', { 
        p_setting_key: 'fee_percentage' 
      })

    if (error) {
      console.error('Error fetching fee percentage:', error)
      return 5.0 // Default fallback
    }

    return parseFloat(data) || 5.0
  } catch (error) {
    console.error('Error fetching fee percentage:', error)
    return 5.0 // Default fallback
  }
}

/**
 * Get escrow wallet address
 */
export async function getEscrowWallet(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_platform_setting', { 
        p_setting_key: 'escrow_wallet_address' 
      })

    if (error) {
      console.error('Error fetching escrow wallet:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching escrow wallet:', error)
    return null
  }
}

/**
 * Get fee collection wallet address
 */
export async function getFeeWallet(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_platform_setting', { 
        p_setting_key: 'fee_wallet_address' 
      })

    if (error) {
      console.error('Error fetching fee wallet:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching fee wallet:', error)
    return null
  }
}

/**
 * Get all platform settings
 */
export async function getAllPlatformSettings(): Promise<{
  feePercentage: number
  escrowWallet: string | null
  feeWallet: string | null
}> {
  const [feePercentage, escrowWallet, feeWallet] = await Promise.all([
    getFeePercentage(),
    getEscrowWallet(),
    getFeeWallet()
  ])

  return {
    feePercentage,
    escrowWallet,
    feeWallet
  }
}












