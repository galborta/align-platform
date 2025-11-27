import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { applicationId, applicantWallet } = await request.json()

    // 1. Check if job is still open and in first_come mode
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'open') {
      return NextResponse.json({ error: 'Job is no longer open' }, { status: 400 })
    }

    if (job.assignment_mode !== 'first_come') {
      return NextResponse.json({ error: 'Job is not in first-come mode' }, { status: 400 })
    }

    // 2. Assign the job to this applicant
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_to: applicantWallet,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', params.jobId)
      .eq('status', 'open') // Race condition protection

    if (updateError) {
      console.error('Error assigning job:', updateError)
      return NextResponse.json({ error: 'Failed to assign job' }, { status: 500 })
    }

    // 3. Award application karma (TODO: integrate with job-karma.ts)
    // await awardApplyToJobKarma(applicantWallet, job.project_id, job.token_mint)

    console.log(`✅ Auto-assigned job ${params.jobId} to ${applicantWallet}`)

    return NextResponse.json({
      success: true,
      message: 'Job auto-assigned successfully'
    })
  } catch (error) {
    console.error('Auto-assign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




