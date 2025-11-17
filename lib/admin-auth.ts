import { PublicKey } from '@solana/web3.js'

export const ADMIN_WALLET = 'GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S'

export function isAdminWallet(publicKey: PublicKey | null): boolean {
  if (!publicKey) return false
  return publicKey.toBase58() === ADMIN_WALLET
}

