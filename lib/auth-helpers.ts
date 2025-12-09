import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface AuthResult {
  success: boolean
  user?: any
  error?: string
  status?: number
}

interface WalletResult {
  success: boolean
  wallet?: string
  error?: string
  status?: number
}

interface AdminResult {
  success: boolean
  admin?: {
    wallet_address: string
    role?: string
  }
  error?: string
  status?: number
}

interface OwnershipResult {
  success: boolean
  error?: string
  status?: number
}

interface FullAuthResult {
  success: boolean
  user?: any
  wallet?: string
  error?: string
  status?: number
}

/**
 * Verify JWT token and return authenticated user
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Unauthorized - Authentication required',
      status: 401
    }
  }

  const token = authHeader.substring(7)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return {
      success: false,
      error: 'Invalid authentication token',
      status: 401
    }
  }

  return {
    success: true,
    user
  }
}

/**
 * Get wallet address for authenticated user
 */
export async function getUserWallet(userId: string, authUser?: any): Promise<WalletResult> {
  // If auth user is provided, try to extract wallet from it first
  if (authUser) {
    // Try user metadata first (for new auth users)
    if (authUser.user_metadata?.wallet_address) {
      return {
        success: true,
        wallet: authUser.user_metadata.wallet_address
      }
    }

    // Try to extract from email ({wallet}@align.solana format)
    if (authUser.email?.endsWith('@align.solana')) {
      const wallet = authUser.email.replace('@align.solana', '')
      return {
        success: true,
        wallet
      }
    }
  }

  // Fallback: try profiles table (legacy)
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address')
    .eq('id', userId)
    .single()

  if (profile?.wallet_address) {
    return {
      success: true,
      wallet: profile.wallet_address
    }
  }

  // Final fallback: try user_profiles table
  if (authUser?.email?.endsWith('@align.solana')) {
    const potentialWallet = authUser.email.replace('@align.solana', '')
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('wallet_address', potentialWallet)
      .single()

    if (userProfile?.wallet_address) {
      return {
        success: true,
        wallet: userProfile.wallet_address
      }
    }
  }

  return {
    success: false,
    error: 'No wallet address linked to account',
    status: 403
  }
}

/**
 * Verify user is an admin by checking admin_wallets table
 */
export async function verifyAdmin(userId: string): Promise<AdminResult> {
  // First get user's wallet
  const walletResult = await getUserWallet(userId)
  if (!walletResult.success) {
    return {
      success: false,
      error: walletResult.error,
      status: walletResult.status
    }
  }

  // Check admin_wallets table
  const { data: adminCheck, error } = await supabaseAdmin
    .from('admin_wallets')
    .select('wallet_address')
    .eq('wallet_address', walletResult.wallet)
    .single()

  if (error || !adminCheck) {
    return {
      success: false,
      error: 'Admin access required',
      status: 403
    }
  }

  return {
    success: true,
    admin: {
      wallet_address: adminCheck.wallet_address,
      role: 'admin' // Default role since admin_wallets table may not have roles
    }
  }
}

/**
 * Verify user owns a resource (poster/worker)
 */
export function verifyOwnership(
  userWallet: string,
  resourceWallet: string,
  resourceType: 'poster' | 'worker' = 'poster'
): OwnershipResult {
  if (userWallet !== resourceWallet) {
    return {
      success: false,
      error: `Only the ${resourceType} can perform this action`,
      status: 403
    }
  }

  return {
    success: true
  }
}

/**
 * Verify service token for automated systems (cron jobs, etc.)
 */
export function verifyServiceToken(request: NextRequest): OwnershipResult {
  const authHeader = request.headers.get('authorization')
  const serviceToken = process.env.SERVICE_AUTH_TOKEN || 'auto-release-internal'
  
  if (authHeader !== `Bearer ${serviceToken}`) {
    return {
      success: false,
      error: 'Invalid service token',
      status: 403
    }
  }

  return {
    success: true
  }
}

/**
 * Complete auth flow: verify token + get wallet
 */
export async function verifyAuthAndGetWallet(request: NextRequest): Promise<FullAuthResult> {
  // Verify token
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return authResult
  }

  // Get wallet
  const walletResult = await getUserWallet(authResult.user!.id)
  if (!walletResult.success) {
    return walletResult
  }

  return {
    success: true,
    user: authResult.user,
    wallet: walletResult.wallet
  }
}

/**
 * Complete auth flow: verify token + get wallet + verify ownership
 */
export async function verifyAuthAndOwnership(
  request: NextRequest,
  expectedWallet: string,
  resourceType: 'poster' | 'worker' = 'poster'
): Promise<FullAuthResult> {
  // Verify token and get wallet
  const authResult = await verifyAuthAndGetWallet(request)
  if (!authResult.success) {
    return authResult
  }

  // Verify ownership
  const ownershipResult = verifyOwnership(
    authResult.wallet!,
    expectedWallet,
    resourceType
  )
  
  if (!ownershipResult.success) {
    return ownershipResult
  }

  return {
    success: true,
    user: authResult.user,
    wallet: authResult.wallet
  }
}

/**
 * Complete admin auth flow: verify token + verify admin status
 */
export async function verifyAdminAuth(request: NextRequest): Promise<FullAuthResult & { admin?: AdminResult['admin'] }> {
  // Verify token
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return authResult
  }

  // Verify admin status
  const adminResult = await verifyAdmin(authResult.user!.id)
  if (!adminResult.success) {
    return adminResult
  }

  return {
    success: true,
    user: authResult.user,
    wallet: adminResult.admin!.wallet_address,
    admin: adminResult.admin
  }
}

