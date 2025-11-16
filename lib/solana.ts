import { Connection, PublicKey } from '@solana/web3.js'
import { getMint } from '@solana/spl-token'

export interface TokenMetadata {
  name: string
  symbol: string
  supply: string
  decimals: number
  mintAddress: string
}

export async function getTokenMetadata(
  mintAddress: string,
  connection: Connection
): Promise<TokenMetadata> {
  const mintPublicKey = new PublicKey(mintAddress)
  
  try {
    // Get mint account info using the provided connection (configured with Helius)
    const mintInfo = await getMint(connection, mintPublicKey)
  
    // Try to fetch metadata from Metaplex standard
    let name = 'Unknown Token'
    let symbol = 'UNKNOWN'
    
    try {
      // Derive metadata PDA (Program Derived Address)
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      )
      
      // Fetch the account info
      const accountInfo = await connection.getAccountInfo(metadataPDA)
      
      if (accountInfo) {
        // Parse metadata (simplified version)
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
        name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '')
        offset += nameLength
        
        // Read symbol (first 4 bytes = length, then string)
        const symbolLength = data.readUInt32LE(offset)
        offset += 4
        symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '')
      }
    } catch (metadataError) {
      console.warn('Could not fetch metadata:', metadataError)
      // Use defaults if metadata not found
    }
    
    // Calculate supply (accounting for decimals)
    const supply = (Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)).toLocaleString()
    
    return {
      name,
      symbol,
      supply,
      decimals: mintInfo.decimals,
      mintAddress,
    }
  } catch (error) {
    console.error('Failed to fetch token metadata:', error)
    throw new Error('Failed to fetch token metadata. Please check the mint address.')
  }
}

