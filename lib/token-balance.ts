import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

interface HolderBalance {
  walletAddress: string
  balance: number
  percentage: number
}

// Get specific wallet's token balance and percentage
export async function getWalletTokenData(
  walletAddress: string,
  tokenMint: string
): Promise<{ balance: number; percentage: number } | null> {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT!, // Your existing Helius RPC
      'confirmed'
    )
    
    const walletPubkey = new PublicKey(walletAddress)
    const mintPubkey = new PublicKey(tokenMint)
    
    // Get token account for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { mint: mintPubkey }
    )
    
    if (tokenAccounts.value.length === 0) {
      return { balance: 0, percentage: 0 }
    }
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
    
    // Get total supply from mint
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey)
    const mintData = (mintInfo.value?.data as any).parsed.info
    const totalSupply = mintData.supply / Math.pow(10, mintData.decimals)
    
    const percentage = (balance / totalSupply) * 100
    
    return { balance, percentage }
    
  } catch (error) {
    console.error('Error fetching token balance:', error)
    return null
  }
}

// Get all token holders using Helius DAS API
export async function getAllTokenHolders(
  tokenMint: string
): Promise<HolderBalance[]> {
  try {
    // Use Helius DAS API to get all token accounts
    const response = await fetch(
      process.env.NEXT_PUBLIC_HELIUS_API_URL!,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'get-token-accounts',
          method: 'getTokenAccounts',
          params: {
            mint: tokenMint,
            page: 1,
            limit: 1000
          }
        })
      }
    )
    
    const data = await response.json()
    
    if (!data.result || !data.result.token_accounts) {
      console.error('No token accounts found')
      return []
    }
    
    // Get total supply
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
      'confirmed'
    )
    const mintPubkey = new PublicKey(tokenMint)
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey)
    const mintData = (mintInfo.value?.data as any).parsed.info
    const totalSupply = mintData.supply / Math.pow(10, mintData.decimals)
    
    // Map to holder balances with percentages
    return data.result.token_accounts.map((account: any) => ({
      walletAddress: account.owner,
      balance: account.amount / Math.pow(10, mintData.decimals),
      percentage: (account.amount / mintData.supply) * 100
    }))
    
  } catch (error) {
    console.error('Error fetching all holders from Helius:', error)
    
    // Fallback: Use standard Solana RPC (slower but works)
    return await getAllTokenHoldersFallback(tokenMint)
  }
}

// Fallback method using standard Solana RPC
async function getAllTokenHoldersFallback(
  tokenMint: string
): Promise<HolderBalance[]> {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
      'confirmed'
    )
    
    const mintPubkey = new PublicKey(tokenMint)
    
    // Get all token accounts for this mint
    const accounts = await connection.getProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        filters: [
          { dataSize: 165 }, // Token account size
          {
            memcmp: {
              offset: 0,
              bytes: mintPubkey.toBase58()
            }
          }
        ]
      }
    )
    
    // Get mint info for decimals and supply
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey)
    const mintData = (mintInfo.value?.data as any).parsed.info
    const totalSupply = mintData.supply / Math.pow(10, mintData.decimals)
    
    // Parse accounts and calculate balances
    const holders: HolderBalance[] = []
    
    for (const account of accounts) {
      const accountInfo = await connection.getParsedAccountInfo(account.pubkey)
      const tokenData = (accountInfo.value?.data as any).parsed.info
      
      if (tokenData.tokenAmount.uiAmount > 0) {
        holders.push({
          walletAddress: tokenData.owner,
          balance: tokenData.tokenAmount.uiAmount,
          percentage: (tokenData.tokenAmount.uiAmount / totalSupply) * 100
        })
      }
    }
    
    return holders
    
  } catch (error) {
    console.error('Fallback method also failed:', error)
    return []
  }
}

// Cache token data for 5 minutes to reduce RPC calls
const tokenDataCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getCachedTokenData(
  walletAddress: string,
  tokenMint: string
): Promise<{ balance: number; percentage: number } | null> {
  const cacheKey = `${walletAddress}-${tokenMint}`
  const cached = tokenDataCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  const data = await getWalletTokenData(walletAddress, tokenMint)
  
  if (data) {
    tokenDataCache.set(cacheKey, { data, timestamp: Date.now() })
  }
  
  return data
}

// Helper to check if wallet holds any tokens
export async function walletHoldsTokens(
  walletAddress: string,
  tokenMint: string
): Promise<boolean> {
  const data = await getCachedTokenData(walletAddress, tokenMint)
  return data !== null && data.balance > 0
}

// Helper to get tier based on percentage (updated thresholds for curation system)
export function getHolderTier(percentage: number): 'mega' | 'whale' | 'holder' | 'small' {
  if (percentage >= 5.0) return 'mega'
  if (percentage >= 1.0) return 'whale'
  if (percentage >= 0.1) return 'holder'
  return 'small'
}

// Legacy functions for chat system compatibility
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

// Legacy HolderInfo interface for backward compatibility with chat
export interface HolderInfo {
  balance: bigint
  percentage: number
  tier: 'mega' | 'whale' | 'holder' | 'small'
}

// Legacy getHolderInfo function for chat system (kept for backward compatibility)
export async function getHolderInfo(
  walletAddress: string,
  tokenMint: string,
  connection: Connection
): Promise<HolderInfo | null> {
  try {
    const data = await getWalletTokenData(walletAddress, tokenMint)
    
    if (!data || data.balance === 0) {
      return null
    }
    
    // Convert to legacy format
    // Note: Chat system uses different tier thresholds (1%, 0.1%, 0.01%)
    let tier: 'mega' | 'whale' | 'holder' | 'small'
    if (data.percentage >= 1.0) {
      tier = 'mega'
    } else if (data.percentage >= 0.1) {
      tier = 'whale'
    } else if (data.percentage >= 0.01) {
      tier = 'holder'
    } else {
      tier = 'small'
    }
    
    return {
      balance: BigInt(Math.floor(data.balance * 1000000)), // Convert to smallest unit
      percentage: data.percentage,
      tier
    }
  } catch (error) {
    console.error('Failed to get holder info:', error)
    return null
  }
}
