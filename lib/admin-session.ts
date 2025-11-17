const ADMIN_SESSION_KEY = 'align_admin_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface AdminSession {
  wallet: string
  timestamp: number
  signature: string
}

export function saveAdminSession(wallet: string, signature: Uint8Array) {
  const session: AdminSession = {
    wallet,
    timestamp: Date.now(),
    signature: Buffer.from(signature).toString('base64')
  }
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(ADMIN_SESSION_KEY)
  if (!stored) return null
  
  try {
    const session: AdminSession = JSON.parse(stored)
    
    // Check if session expired
    if (Date.now() - session.timestamp > SESSION_DURATION) {
      clearAdminSession()
      return null
    }
    
    return session
  } catch {
    return null
  }
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

export function isSessionValid(wallet: string): boolean {
  const session = getAdminSession()
  if (!session) return false
  return session.wallet === wallet
}

