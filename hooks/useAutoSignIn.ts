/**
 * Auto Sign-In Hook
 * 
 * Automatically signs in users to Supabase when they connect their wallet.
 * This ensures that verified wallets always have an active Supabase session.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { useVerification } from '@/contexts/VerificationContext'

export function useAutoSignIn() {
  const { publicKey, connected } = useWallet()
  const { isVerified } = useVerification()
  const hasAttemptedSignIn = useRef(false)

  useEffect(() => {
    const attemptSignIn = async () => {
      console.log('[AutoSignIn] Checking conditions...')
      console.log('  - connected:', connected)
      console.log('  - publicKey:', publicKey?.toBase58().slice(0, 8))
      console.log('  - isVerified:', isVerified)
      console.log('  - hasAttempted:', hasAttemptedSignIn.current)
      
      // Only attempt once per wallet connection
      if (!connected || !publicKey || !isVerified || hasAttemptedSignIn.current) {
        console.log('[AutoSignIn] Skipping sign-in attempt')
        return
      }

      const wallet = publicKey.toBase58()
      console.log('[AutoSignIn] Checking session for:', wallet.slice(0, 8) + '...')
      
      // Check if already signed in
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        console.log('[AutoSignIn] ✅ Already signed in, session expires:', new Date(session.expires_at! * 1000))
        hasAttemptedSignIn.current = true
        return
      }
      
      console.log('[AutoSignIn] No active session, will attempt sign-in...')

      // Sign in with wallet-based credentials
      const authEmail = `${wallet}@align.solana`
      const authPassword = wallet

      try {
        console.log('[AutoSignIn] Attempting auto sign-in for:', wallet.slice(0, 8) + '...')
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })

        if (error) {
          console.warn('[AutoSignIn] Sign-in failed:', error.message)
          console.log('[AutoSignIn] Attempting to migrate wallet to auth system...')
          
          // Try to migrate the wallet (create auth account)
          try {
            const migrateResponse = await fetch('/api/auth/migrate-wallet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wallet }),
            })
            
            if (migrateResponse.ok) {
              console.log('[AutoSignIn] ✅ Wallet migrated, retrying sign-in...')
              
              // Retry sign-in after migration
              const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: authPassword,
              })
              
              if (retryError) {
                console.error('[AutoSignIn] Sign-in failed after migration:', retryError.message)
              } else {
                console.log('[AutoSignIn] ✅ Successfully signed in after migration')
                hasAttemptedSignIn.current = true
              }
            } else {
              console.warn('[AutoSignIn] Migration failed - wallet may need re-verification')
            }
          } catch (migrateErr) {
            console.error('[AutoSignIn] Migration error:', migrateErr)
          }
        } else {
          console.log('[AutoSignIn] ✅ Successfully signed in')
          hasAttemptedSignIn.current = true
        }
      } catch (err) {
        console.error('[AutoSignIn] Error:', err)
      }
    }

    attemptSignIn()
  }, [connected, publicKey, isVerified])

  // Reset flag when wallet disconnects
  useEffect(() => {
    if (!connected) {
      hasAttemptedSignIn.current = false
    }
  }, [connected])
}

