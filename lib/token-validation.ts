import { Connection, PublicKey } from '@solana/web3.js'

/**
 * Token metadata interface returned by Helius DAS API
 */
export interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  logo?: string
  supply?: string
}

/**
 * Validates if a string is a valid Solana address format
 * @param address - String to validate
 * @returns true if valid Solana address, false otherwise
 */
export function validateSolanaAddress(address: string): boolean {
  try {
    // Attempt to create a PublicKey from the string
    new PublicKey(address)
    return true
  } catch (error) {
    // PublicKey constructor throws if invalid
    return false
  }
}

/**
 * Fetches token metadata from Helius DAS API with timeout
 * @param mintAddress - Token mint address
 * @returns Token metadata object or null if not found/error
 */
export async function fetchTokenMetadata(
  mintAddress: string
): Promise<TokenMetadata | null> {
  try {
    // Get Helius API URL from environment
    const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_API_URL
    
    if (!heliusUrl) {
      console.error('NEXT_PUBLIC_HELIUS_API_URL not configured')
      return null
    }

    // Create abort controller for 5 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      // Use RPC endpoint to get mint info
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT || heliusUrl
      const connection = new Connection(rpcUrl, 'confirmed')

      // First, verify the mint exists by trying to get account info
      const mintPublicKey = new PublicKey(mintAddress)
      const accountInfo = await connection.getAccountInfo(mintPublicKey)
      
      if (!accountInfo) {
        console.warn(`Token mint not found: ${mintAddress}`)
        return null
      }

      // Try to fetch metadata from Metaplex standard using Helius DAS API
      const response = await fetch(heliusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'get-asset',
          method: 'getAsset',
          params: {
            id: mintAddress,
          },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error('Helius API request failed:', response.statusText)
        return null
      }

      const data = await response.json()

      // Check for RPC error
      if (data.error) {
        console.warn('Helius API error:', data.error.message)
        // Token exists but no metadata, try basic info
        return await fetchBasicTokenInfo(mintAddress, connection)
      }

      // Parse metadata from response
      const asset = data.result
      
      if (!asset) {
        // Token exists but no DAS metadata, try basic info
        return await fetchBasicTokenInfo(mintAddress, connection)
      }

      // Extract metadata
      const metadata: TokenMetadata = {
        name: asset.content?.metadata?.name || 'Unknown Token',
        symbol: asset.content?.metadata?.symbol || 'UNKNOWN',
        decimals: asset.token_info?.decimals ?? 9,
        logo: asset.content?.links?.image || asset.content?.files?.[0]?.uri,
        supply: asset.token_info?.supply,
      }

      return metadata

    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        console.error('Token metadata fetch timeout after 5 seconds')
        return null
      }

      throw fetchError
    }

  } catch (error) {
    console.error('Error fetching token metadata:', error)
    return null
  }
}

/**
 * Fallback method to fetch basic token info when DAS API fails
 * @param mintAddress - Token mint address
 * @param connection - Solana connection
 * @returns Basic token metadata or null
 */
async function fetchBasicTokenInfo(
  mintAddress: string,
  connection: Connection
): Promise<TokenMetadata | null> {
  try {
    const { getMint } = await import('@solana/spl-token')
    const mintPublicKey = new PublicKey(mintAddress)
    const mintInfo = await getMint(connection, mintPublicKey)

    // Try to fetch metadata from Metaplex standard PDA
    let name = 'Unknown Token'
    let symbol = 'UNKNOWN'

    try {
      const METADATA_PROGRAM_ID = new PublicKey(
        'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
      )
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      )

      const accountInfo = await connection.getAccountInfo(metadataPDA)

      if (accountInfo) {
        const data = accountInfo.data

        // Skip the first byte (key)
        let offset = 1

        // Skip update authority (32 bytes)
        offset += 32

        // Skip mint (32 bytes)
        offset += 32

        // Read name (first 4 bytes = length, then string)
        const nameLength = data.readUInt32LE(offset)
        offset += 4
        name = data
          .slice(offset, offset + nameLength)
          .toString('utf8')
          .replace(/\0/g, '')
        offset += nameLength

        // Read symbol (first 4 bytes = length, then string)
        const symbolLength = data.readUInt32LE(offset)
        offset += 4
        symbol = data
          .slice(offset, offset + symbolLength)
          .toString('utf8')
          .replace(/\0/g, '')
      }
    } catch (metadataError) {
      console.warn('Could not fetch Metaplex metadata:', metadataError)
      // Use defaults
    }

    const supply = (
      Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)
    ).toLocaleString()

    return {
      name,
      symbol,
      decimals: mintInfo.decimals,
      supply,
    }
  } catch (error) {
    console.error('Error fetching basic token info:', error)
    return null
  }
}

/**
 * Validates if an address is a valid token mint with existing metadata
 * @param address - Address to validate
 * @returns true if valid token mint with metadata, false otherwise
 */
export async function isValidTokenMint(address: string): Promise<boolean> {
  // First check if it's a valid Solana address
  if (!validateSolanaAddress(address)) {
    return false
  }

  // Then try to fetch metadata to confirm it's a real token
  const metadata = await fetchTokenMetadata(address)
  
  // Return true only if we successfully fetched metadata
  return metadata !== null
}



