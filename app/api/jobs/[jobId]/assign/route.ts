/**
 * API Route: Assign Job to Worker
 * Uses service role to bypass RLS and handle job assignment
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
    const { 
      poster_wallet, 
      assigned_to, 
      hard_deadline 
    } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    if (!poster_wallet) {
      return NextResponse.json({ error: 'Poster wallet required' }, { status: 400 })
    }

    if (!assigned_to) {
      return NextResponse.json({ error: 'Worker wallet required' }, { status: 400 })
    }

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

    // Verify poster
    if (job.poster_wallet !== poster_wallet) {
      return NextResponse.json({ error: 'Only the job poster can assign this job' }, { status: 403 })
    }

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

