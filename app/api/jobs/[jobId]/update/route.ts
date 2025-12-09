import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/jobs/[jobId]/update
 * 
 * Update a job's details (poster only)
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can update the job
 * 
 * Request body:
 * - title: string (optional) - Job title
 * - description: string (optional) - Job description
 * - kpis: string (optional) - Success criteria/KPIs
 * - category: string (optional) - Job category
 * - assignment_mode: string (optional) - 'first_come' or 'review'
 * - poster_desired_completion: string (optional) - ISO date string
 * - payment_amount_tokens: number (optional) - New payment amount (only if no applications)
 * - payment_amount_usd: number (optional) - New USD value (only if no applications)
 * 
 * Returns:
 * - 200: { success: true, invalidated_applications: number }
 * - 401: { error: string } - Unauthorized (missing/invalid token)
 * - 403: { error: string } - Forbidden (not poster or cannot change payment)
 * - 500: { error: string } - Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    // Parse request body for update data
    const body = await request.json()
    const { 
      title,
      description,
      kpis,
      category,
      assignment_mode,
      poster_desired_completion,
      payment_amount_tokens,
      payment_amount_usd
    } = body

    // ==================== AUTHENTICATION ====================

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Update Job] Missing authorization header')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Update Job] Invalid auth token:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log(`[Update Job] Authenticated user: ${user.id}`)

    // Import the helper at the top if not already imported
    const { getUserWallet } = await import('@/lib/auth-helpers')
    
    const walletResult = await getUserWallet(user.id, user)
    if (!walletResult.success) {
      console.error('[Update Job] No wallet found for user:', user.id)
      return NextResponse.json(
        { error: walletResult.error },
        { status: walletResult.status || 403 }
      )
    }

    const authenticatedWallet = walletResult.wallet
    console.log(`[Update Job] Authenticated wallet: ${authenticatedWallet.slice(0, 8)}...`)
    console.log(`[Update Job] User wallet: ${authenticatedWallet}`)

    // ==================== FETCH AND VALIDATE JOB ====================

    console.log(`[Update Job API] Updating job ${jobId}`)

    // Fetch job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Update Job API] Job fetch error:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // ==================== AUTHORIZATION ====================

    // Verify user is the job poster
    if (authenticatedWallet !== job.poster_wallet) {
      console.warn(`[Update Job API] Unauthorized update attempt`)
      return NextResponse.json(
        { error: 'Only the job poster can update this job' },
        { status: 403 }
      )
    }

    console.log('[Update Job] ✅ Authorization verified')

    // Check for existing applications
    const { count: applicationCount, error: countError } = await supabaseAdmin
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('is_invalidated', false)

    if (countError) {
      console.error('[Update Job API] Count error:', countError)
      throw countError
    }

    console.log(`[Update Job API] Active applications: ${applicationCount}`)

    // Check if trying to change payment amount with applications
    const isChangingPayment = payment_amount_tokens !== undefined && payment_amount_tokens !== job.payment_amount_tokens
    if (isChangingPayment && applicationCount && applicationCount > 0) {
      return NextResponse.json(
        { error: 'Cannot change payment amount after applications have been submitted' },
        { status: 403 }
      )
    }

    // Build update object with only provided fields
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updates.title = title.trim()
    if (description !== undefined) updates.description = description.trim()
    if (kpis !== undefined) updates.kpis = kpis.trim()
    if (category !== undefined) updates.category = category
    if (assignment_mode !== undefined) updates.assignment_mode = assignment_mode
    if (poster_desired_completion !== undefined) updates.poster_desired_completion = poster_desired_completion

    // Only allow payment changes if no applications
    if (payment_amount_tokens !== undefined && (!applicationCount || applicationCount === 0)) {
      updates.payment_amount_tokens = payment_amount_tokens
      if (payment_amount_usd !== undefined) {
        updates.payment_amount_usd = payment_amount_usd
      }
      console.log(`[Update Job API] Updating payment amount to ${payment_amount_tokens}`)
    }

    // Update job
    console.log('[Update Job API] Updating job...')
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update(updates)
      .eq('id', jobId)

    if (updateError) {
      console.error('[Update Job API] Update error:', updateError)
      throw updateError
    }

    console.log('[Update Job API] ✅ Job updated')

    // Invalidate applications if there are any
    let invalidatedCount = 0
    if (applicationCount && applicationCount > 0) {
      console.log('[Update Job API] Invalidating applications...')
      const { error: invalidateError } = await supabaseAdmin
        .from('job_applications')
        .update({
          is_invalidated: true,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('is_invalidated', false)

      if (invalidateError) {
        console.error('[Update Job API] Invalidate error:', invalidateError)
        throw invalidateError
      }

      invalidatedCount = applicationCount
      console.log(`[Update Job API] ✅ Invalidated ${invalidatedCount} applications`)
    }

    // TODO: Send notifications to applicants if any were invalidated

    console.log(`[Update Job API] ✅ Job ${jobId} updated successfully`)

    return NextResponse.json({ 
      success: true,
      invalidated_applications: invalidatedCount
    })

  } catch (error) {
    console.error('[Update Job API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

