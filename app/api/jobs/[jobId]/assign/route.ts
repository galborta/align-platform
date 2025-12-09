/**
 * API Route: Assign Job to Worker
 * Uses service role to bypass RLS and handle job assignment
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can assign workers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Parse request body for assignment data
    const body = await request.json()
    const { assigned_to, hard_deadline } = body

    if (!assigned_to) {
      return NextResponse.json({ error: 'Worker wallet required' }, { status: 400 })
    }

    // ==================== AUTHENTICATION ====================

    // Authenticate request
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Assign Job] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Assign Job] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Assign Job] Authenticated user: ${user.id}`)

    // Get user's wallet using the helper function
    const { getUserWallet } = await import('@/lib/auth-helpers')
    const walletResult = await getUserWallet(user.id, user)

    if (!walletResult.success) {
      console.error('[Assign Job] No wallet found for user:', user.id)
      return NextResponse.json(
        { error: walletResult.error },
        { status: walletResult.status || 403 }
      )
    }

    const authenticatedWallet = walletResult.wallet
    console.log(`[Assign Job] User wallet: ${authenticatedWallet.slice(0, 8)}...`)

    // ==================== FETCH AND VALIDATE JOB ====================

    console.log(`📝 Assigning job ${jobId} to ${assigned_to}`)

    // Fetch job to verify ownership and status
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('jobs')
      .select('poster_wallet, status, assignment_mode')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      console.error('Error fetching job for assignment:', fetchError)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (authenticatedWallet !== job.poster_wallet) {
      console.error('[Assign Job] Unauthorized - not job poster')
      return NextResponse.json(
        { error: 'Only job poster can assign this job' },
        { status: 403 }
      )
    }

    console.log('[Assign Job] ✅ Authorization verified')

    // Verify job is open (allow assignment if already assigned for reassignment purposes)
    if (job.status !== 'open' && job.status !== 'assigned') {
      return NextResponse.json({ error: 'Job must be open to assign' }, { status: 400 })
    }

    // Update job with assignment
    console.log('📝 Updating job status to assigned...')
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_to,
        assigned_at: new Date().toISOString(),
        hard_deadline: hard_deadline || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Error updating job for assignment:', updateError)
      throw updateError
    }

    console.log('✅ Job assigned successfully')

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Assign API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

