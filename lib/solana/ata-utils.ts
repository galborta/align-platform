import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token'

/**
 * Check if an Associated Token Account exists for a wallet+mint
 * 
 * @param connection - Solana connection
 * @param walletAddress - Wallet public key
 * @param tokenMint - Token mint public key
 * @returns True if ATA exists, false otherwise
 * 
 * @example
 * ```typescript
 * const exists = await checkAtaExists(
 *   connection,
 *   new PublicKey('wallet...'),
 *   new PublicKey('mint...')
 * )
 * ```
 */
export async function checkAtaExists(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMint: PublicKey
): Promise<boolean> {
  try {
    const ata = await getAssociatedTokenAddress(
      tokenMint,
      walletAddress,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const accountInfo = await connection.getAccountInfo(ata)
    return accountInfo !== null
  } catch (error) {
    console.error('Error checking ATA:', error)
    return false
  }
}

/**
 * Create instruction to initialize an ATA (payer pays rent)
 * 
 * @param payer - Public key of the account paying for the ATA creation
 * @param owner - Public key of the account that will own the ATA
 * @param mint - Token mint public key
 * @returns Transaction instruction to create the ATA
 * 
 * @example
 * ```typescript
 * const instruction = createAtaInstruction(
 *   payerPublicKey,
 *   recipientPublicKey,
 *   tokenMintPublicKey
 * )
 * transaction.add(instruction)
 * ```
 */
export function createAtaInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return createAssociatedTokenAccountInstruction(
    payer,        // Payer of the initialization
    getAssociatedTokenAddressSync(owner, mint), // ATA address
    owner,        // Owner of the new account
    mint,         // Token mint
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
}

/**
 * Get ATA address synchronously (internal helper)
 */
function getAssociatedTokenAddressSync(
  owner: PublicKey,
  mint: PublicKey
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer()
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return address
}

/**
 * Estimate cost of ATA creation (rent-exempt minimum)
 * Typically ~0.00203928 SOL
 * 
 * @returns Estimated SOL cost for ATA creation
 * 
 * @example
 * ```typescript
 * const cost = estimateAtaCost() // 0.00203928
 * console.log(`ATA creation will cost ~${cost} SOL`)
 * ```
 */
export function estimateAtaCost(): number {
  return 0.00203928
}

/**
 * Get ATA address for a wallet+mint (synchronous, public utility)
 * 
 * @param owner - Public key of the token account owner
 * @param mint - Token mint public key
 * @returns The associated token account address
 * 
 * @example
 * ```typescript
 * const ataAddress = getAtaAddress(
 *   walletPublicKey,
 *   tokenMintPublicKey
 * )
 * ```
 */
export function getAtaAddress(
  owner: PublicKey,
  mint: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(owner, mint)
}



