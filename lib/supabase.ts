import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Server-side admin client with service role key (bypasses RLS)
// Only created on server-side where the env var is available
let _supabaseAdmin: SupabaseClient<Database> | null = null

export const supabaseAdmin: SupabaseClient<Database> = (() => {
  // Only create admin client on server side
  if (typeof window !== 'undefined') {
    // Return a dummy client on client side - should never be used there
    // This prevents the error when the file is imported on client
    return supabase as SupabaseClient<Database>
  }
  
  if (!_supabaseAdmin) {
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceRoleKey) {
      console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY not available - admin client will use anon key')
      return supabase as SupabaseClient<Database>
    }
    _supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  return _supabaseAdmin
})()








