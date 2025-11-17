import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'

export interface HolderInfo {
  balance: bigint
  percentage: number
  tier: 'mega' | 'whale' | 'holder' | 'small'
}

export async function getHolderInfo(
  walletAddress: string,
  tokenMint: string,
  connection: Connection
): Promise<HolderInfo | null> {
  try {
    const walletPubkey = new PublicKey(walletAddress)
    const mintPubkey = new PublicKey(tokenMint)
    
    // Get associated token account
    const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey)
    
    // Check if token account exists first
    const accountInfo = await connection.getAccountInfo(ata)
    
    if (!accountInfo) {
      // Token account doesn't exist = no tokens held
      console.log(`No token account found for wallet ${walletAddress}`)
      return null
    }
    
    // Get token account details
    let tokenAccount
    try {
      tokenAccount = await getAccount(connection, ata)
    } catch (error) {
      console.error('Error getting token account:', error)
      return null
    }
    
    // Check if balance is 0
    if (tokenAccount.amount === 0n) {
      console.log(`Token account exists but balance is 0 for wallet ${walletAddress}`)
      return null
    }
    
    // Get mint info for total supply
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey)
    const mintData = mintInfo.value?.data
    
    if (!mintData || !('parsed' in mintData)) {
      console.error('Invalid mint data')
      return null
    }
    
    const supply = mintData.parsed.info.supply
    const decimals = mintData.parsed.info.decimals
    
    // Calculate percentage of supply
    const balance = tokenAccount.amount
    const percentage = (Number(balance) / Number(supply)) * 100
    
    // Determine tier based on percentage
    let tier: 'mega' | 'whale' | 'holder' | 'small'
    if (percentage >= 1.0) {
      tier = 'mega'
    } else if (percentage >= 0.1) {
      tier = 'whale'
    } else if (percentage >= 0.01) {
      tier = 'holder'
    } else {
      tier = 'small'
    }
    
    console.log(`Holder info for ${walletAddress}: ${Number(balance)} tokens (${percentage.toFixed(6)}%), tier: ${tier}`)
    
    return { balance, percentage, tier }
  } catch (error) {
    // Unexpected error
    console.error('Failed to get holder info:', error)
    return null
  }
}

export function getTierDisplay(tier: string) {
  const displays = {
    mega: { emoji: '🐋', label: 'Mega Holder' },
    whale: { emoji: '💎', label: 'Whale' },
    holder: { emoji: '🟢', label: 'Holder' },
    small: { emoji: '⚪', label: 'Small Holder' }
  }
  return displays[tier as keyof typeof displays] || displays.small
}

export function getTierStyles(tier: string) {
  const styles = {
    mega: {
      border: 'border-l-4 border-purple-500',
      bg: 'bg-purple-50',
      text: 'text-purple-900'
    },
    whale: {
      border: 'border-l-4 border-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-900'
    },
    holder: {
      border: 'border-l-4 border-green-500',
      bg: 'bg-green-50',
      text: 'text-green-900'
    },
    small: {
      border: 'border-l-4 border-gray-300',
      bg: 'bg-white',
      text: 'text-gray-700'
    }
  }
  return styles[tier as keyof typeof styles] || styles.small
}

// Client-side caching to avoid excessive RPC calls
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function getCachedHolderInfo(walletAddress: string): HolderInfo | null {
  if (typeof window === 'undefined') return null
  
  const cached = localStorage.getItem(`holder_${walletAddress}`)
  if (!cached) return null
  
  const { data, timestamp } = JSON.parse(cached)
  
  // Check if cache is still valid
  if (Date.now() - timestamp > CACHE_DURATION) {
    localStorage.removeItem(`holder_${walletAddress}`)
    return null
  }
  
  return data
}

export function setCachedHolderInfo(walletAddress: string, info: HolderInfo) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(
    `holder_${walletAddress}`,
    JSON.stringify({
      data: info,
      timestamp: Date.now()
    })
  )
}

