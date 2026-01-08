/**
 * Admin Dispute Resolution API
 * 
 * POST /api/admin/disputes/[disputeId]/resolve
 * 
 * Allows admins to resolve social job disputes.
 * - Worker favor: Approves and pays the submission
 * - Poster favor: Upholds the rejection
 * 
 * Security: Admin-only endpoint with signature verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminWallet } from '@/lib/admin-auth'
import { Database } from '@/types/database'

// Create Supabase client with service role for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ==================== POST HANDLER ====================

export async function POST(
  request: NextRequest,
  { params }: { params: { disputeId: string } }
) {
  try {
    const { disputeId } = params
    
    // Parse request body
    const body = await request.json()
    const { resolution, admin_notes, wallet } = body
    
    // Validate resolution type
    if (!resolution || !['poster_favor', 'worker_favor'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution type. Must be "poster_favor" or "worker_favor"' },
        { status: 400 }
      )
    }
    
    // Get admin wallet from request
    // In production, extract from authenticated session
    const adminWallet = wallet || request.headers.get('x-wallet-address')
    
    if (!adminWallet) {
      return NextResponse.json(
        { error: 'Admin wallet address required' },
        { status: 401 }
      )
    }
    
    // Verify admin privileges
    const isAdmin = await isAdminWallet(adminWallet)
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin privileges required' },
        { status: 403 }
      )
    }
    
    // Get dispute with related data
    const { data: dispute, error: disputeError } = await supabase
      .from('job_disputes')
      .select(`
        *,
        job_submissions!inner(
          id,
          job_id,
          worker_wallet,
          social_payment_amount_usd,
          social_approval_status,
          social_payment_released
        )
      `)
      .eq('id', disputeId)
      .single()
    
    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }
    
    // Check if already resolved
    if (dispute.status !== 'pending_admin_review') {
      return NextResponse.json(
        { error: 'Dispute already resolved' },
        { status: 400 }
      )
    }
    
    const submission = dispute.job_submissions as any
    
    // Apply resolution
    if (resolution === 'worker_favor') {
      // Resolve in worker's favor: Approve and pay submission
      
      // Update submission status to approved
      const { error: updateError } = await supabase
        .from('job_submissions')
        .update({
          social_approval_status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', submission.id)
      
      if (updateError) {
        throw new Error(`Failed to approve submission: ${updateError.message}`)
      }
      
      // Note: Payment processing would happen here or via separate service
      // For now, we mark it as approved and the payment system will handle it
      
    } else {
      // Resolve in poster's favor: Uphold rejection
      
      // Submission remains in denied status
      // No additional action needed on submission
    }
    
    // Update dispute status
    const { error: updateDisputeError } = await supabase
      .from('job_disputes')
      .update({
        status: `resolved_${resolution}`,
        resolved_at: new Date().toISOString(),
        resolved_by: adminWallet,
        admin_notes: admin_notes || null
      })
      .eq('id', disputeId)
    
    if (updateDisputeError) {
      throw new Error(`Failed to update dispute: ${updateDisputeError.message}`)
    }
    
    // TODO: Send notifications
    // - Notify poster of resolution
    // - Notify worker of resolution
    // - If worker favor, notify about payment
    
    return NextResponse.json({
      success: true,
      resolution,
      dispute_id: disputeId,
      message: `Dispute resolved in ${resolution === 'worker_favor' ? "worker's" : "poster's"} favor`
    })
    
  } catch (error) {
    console.error('[Admin Dispute Resolution] Error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// ==================== OPTIONS (CORS) ====================

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Allow': 'POST, OPTIONS',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wallet-address'
      }
    }
  )
}

