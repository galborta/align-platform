import { Connection, PublicKey } from '@solana/web3.js'

interface HeliusPriceData {
  tokenAddress: string
  priceUsd: number
  timestamp: number
}

/**
 * Get current USD price for a token using DexScreener API
 * (Same API used in project page - works with NUB and most tokens)
 * @param tokenMint - Token mint address
 * @returns Price in USD or null if unavailable
 */
export async function getTokenPriceUsd(tokenMint: string): Promise<number | null> {
  try {
    // Use DexScreener (free, no API key needed)
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`)
    const dexData = await dexRes.json()
    
    console.log('DexScreener response:', dexData)
    
    // DexScreener returns pairs, we'll take the first one with most liquidity
    if (dexData.pairs && dexData.pairs.length > 0) {
      const mainPair = dexData.pairs[0]
      const price = parseFloat(mainPair.priceUsd)
      
      if (price && !isNaN(price)) {
        return price
      }
    }
    
    console.warn(`No price data for token ${tokenMint}`)
    return null
    
  } catch (error) {
    console.error('Error fetching token price:', error)
    return null
  }
}

/**
 * Validate if token amount meets minimum USD threshold
 * @param tokenMint - Token mint address
 * @param tokenAmount - Amount of tokens
 * @param minUsd - Minimum USD value required (default $5)
 * @returns { valid: boolean, usdValue: number | null }
 */
export async function validateMinimumUsdValue(
  tokenMint: string,
  tokenAmount: number,
  minUsd: number = 5
): Promise<{ valid: boolean; usdValue: number | null }> {
  const priceUsd = await getTokenPriceUsd(tokenMint)
  
  if (priceUsd === null) {
    return { valid: false, usdValue: null }
  }

  const totalUsd = tokenAmount * priceUsd
  return {
    valid: totalUsd >= minUsd,
    usdValue: totalUsd
  }
}

