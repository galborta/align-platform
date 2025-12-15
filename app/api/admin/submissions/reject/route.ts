/**
 * POST /api/admin/submissions/reject
 * 
 * Rejects a project submission
 * 
 * @module app/api/admin/submissions/reject
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ADMIN_WALLETS } from '@/lib/admin-auth'

// ==================== TYPES ====================

interface RejectSubmissionRequest {
  submissionId: string
  adminWallet: string
}

interface RejectSubmissionResponse {
  success: boolean
  status: 'rejected'
}

interface ErrorResponse {
  error: string
  details?: string
  code?: string
}

// ==================== HELPERS ====================

/**
 * Verify admin authentication
 */
function isAdmin(wallet: string): boolean {
  return ADMIN_WALLETS.includes(wallet)
}

// ==================== MAIN HANDLER ====================

/**
 * POST /api/admin/submissions/reject
 * 
 * Request body:
 * - submissionId: string (required)
 * - adminWallet: string (required)
 * 
 * Response:
 * - success: boolean
 * - status: 'rejected'
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ==================== PARSE REQUEST ====================
    let body: RejectSubmissionRequest
    try {
      body = await request.json()
    } catch {
      console.warn('[Reject Submission] Invalid JSON in request body')
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: 'Request body must be valid JSON',
          code: 'INVALID_JSON'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const { submissionId, adminWallet } = body
    
    console.log('[Reject Submission] Request received')
    console.log(`[Reject Submission] Submission ID: ${submissionId}`)
    console.log(`[Reject Submission] Admin: ${adminWallet?.slice(0, 8)}...`)
    
    // ==================== VALIDATE REQUIRED FIELDS ====================
    if (!submissionId || typeof submissionId !== 'string') {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          details: 'submissionId is required',
          code: 'MISSING_SUBMISSION_ID'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    if (!adminWallet || typeof adminWallet !== 'string') {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          details: 'adminWallet is required',
          code: 'MISSING_ADMIN_WALLET'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // ==================== VERIFY ADMIN AUTHENTICATION ====================
    if (!isAdmin(adminWallet)) {
      console.warn(`[Reject Submission] Unauthorized admin attempt: ${adminWallet.slice(0, 8)}...`)
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: 'You do not have permission to reject submissions',
          code: 'UNAUTHORIZED'
        } satisfies ErrorResponse,
        { status: 401 }
      )
    }
    
    console.log('[Reject Submission] Admin verified')
    
    // ==================== FETCH SUBMISSION ====================
    const { data: submission, error: fetchError } = await supabase
      .from('project_submissions')
      .select('*, conversation_id')
      .eq('id', submissionId)
      .single()
    
    if (fetchError || !submission) {
      console.error('[Reject Submission] Submission not found:', fetchError?.message)
      return NextResponse.json(
        { 
          error: 'Submission not found',
          details: 'The specified submission does not exist',
          code: 'NOT_FOUND'
        } satisfies ErrorResponse,
        { status: 404 }
      )
    }
    
    console.log(`[Reject Submission] Found submission: ${submission.name}`)
    
    // ==================== VERIFY PENDING STATUS ====================
    if (submission.status !== 'pending') {
      console.warn(`[Reject Submission] Submission already ${submission.status}`)
      return NextResponse.json(
        { 
          error: 'Invalid submission status',
          details: `This submission has already been ${submission.status}`,
          code: 'INVALID_STATUS'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    console.log('[Reject Submission] Status verified as pending')
    
    // ==================== UPDATE SUBMISSION STATUS ====================
    const { error: updateError } = await supabase
      .from('project_submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminWallet
      })
      .eq('id', submissionId)
    
    if (updateError) {
      console.error('[Reject Submission] Error updating submission:', updateError.message)
      return NextResponse.json(
        { 
          error: 'Failed to update submission status',
          details: 'Database error occurred',
          code: 'STATUS_UPDATE_FAILED'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    console.log('[Reject Submission] Submission status updated to rejected')
    
    // ==================== REMOVE PROJECT SUBMISSION TAG ====================
    if (submission.conversation_id) {
      const { error: tagError } = await supabase.rpc('remove_conversation_tag', {
        p_conversation_id: submission.conversation_id,
        p_tag: 'Project Submission'
      })
      
      if (tagError) {
        console.warn('[Reject Submission] Failed to remove tag (non-critical):', tagError.message)
      } else {
        console.log('[Reject Submission] Removed "Project Submission" tag')
      }
    }
    
    // ==================== SEND REJECTION EMAIL ====================
    // Note: Rejection is ONLY sent via email (not posted to conversation)
    // Send rejection email to submitter
    try {
      // Import the direct email function
      const { sendEmailDirect } = await import('@/app/api/emails/send/route')
      
      const emailResult = await sendEmailDirect({
        type: 'project_rejected',
        to: submission.email,
        data: {
          submitterName: submission.name,
          tokenSymbol: submission.token_symbol,
          tokenName: submission.token_name
        }
      })
      
      if (emailResult.success) {
        console.log('[Reject Submission] ✅ Rejection email sent to submitter:', emailResult.messageId)
      } else {
        console.warn('[Reject Submission] Rejection email failed:', emailResult.error, emailResult.details)
      }
    } catch (emailError) {
      // Don't fail rejection if email fails
      console.error('[Reject Submission] Failed to send rejection email (non-critical):', emailError)
    }
    
    // ==================== BUILD RESPONSE ====================
    const duration = Date.now() - startTime
    console.log(`[Reject Submission] ✅ Success! Completed in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      status: 'rejected'
    } satisfies RejectSubmissionResponse)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Reject Submission] ❌ Unexpected error after ${duration}ms:`, error)
    
    if (error instanceof Error) {
      console.error('[Reject Submission] Error name:', error.name)
      console.error('[Reject Submission] Error message:', error.message)
      console.error('[Reject Submission] Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      } satisfies ErrorResponse,
      { status: 500 }
    )
  }
}

// ==================== UNSUPPORTED METHODS ====================

export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests',
      code: 'METHOD_NOT_ALLOWED'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests',
      code: 'METHOD_NOT_ALLOWED'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests',
      code: 'METHOD_NOT_ALLOWED'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests',
      code: 'METHOD_NOT_ALLOWED'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}
