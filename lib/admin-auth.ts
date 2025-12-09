import { PublicKey } from '@solana/web3.js'

// Admin wallets - add more addresses to this array as needed
export const ADMIN_WALLETS = [
  'Eyyue9xYUiGFqQ8yjBowfiiAgG41hD4mAxb79nThN6ev', // Primary admin
]

// Legacy export for backwards compatibility
export const ADMIN_WALLET = ADMIN_WALLETS[0]

export function isAdminWallet(publicKey: PublicKey | null): boolean {
  if (!publicKey) return false
  return ADMIN_WALLETS.includes(publicKey.toBase58())
}

