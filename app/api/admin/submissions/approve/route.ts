/**
 * POST /api/admin/submissions/approve
 * 
 * Approves a project submission and generates creation token
 * 
 * @module app/api/admin/submissions/approve
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ADMIN_WALLETS } from '@/lib/admin-auth'
import { randomBytes } from 'crypto'

// ==================== TYPES ====================

interface ApproveSubmissionRequest {
  submissionId: string
  adminWallet: string
}

interface ApproveSubmissionResponse {
  success: boolean
  token: string
  creationLink: string
}

interface ErrorResponse {
  error: string
  details?: string
  code?: string
}

// ==================== HELPERS ====================

/**
 * Generate secure random token for project creation
 */
function generateCreationToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Verify admin authentication
 */
function isAdmin(wallet: string): boolean {
  return ADMIN_WALLETS.includes(wallet)
}

// ==================== MAIN HANDLER ====================

/**
 * POST /api/admin/submissions/approve
 * 
 * Request body:
 * - submissionId: string (required)
 * - adminWallet: string (required)
 * 
 * Response:
 * - success: boolean
 * - token: string (creation token)
 * - creationLink: string (full URL to create project)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ==================== PARSE REQUEST ====================
    let body: ApproveSubmissionRequest
    try {
      body = await request.json()
    } catch {
      console.warn('[Approve Submission] Invalid JSON in request body')
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
    
    console.log('[Approve Submission] Request received')
    console.log(`[Approve Submission] Submission ID: ${submissionId}`)
    console.log(`[Approve Submission] Admin: ${adminWallet?.slice(0, 8)}...`)
    
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
      console.warn(`[Approve Submission] Unauthorized admin attempt: ${adminWallet.slice(0, 8)}...`)
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: 'You do not have permission to approve submissions',
          code: 'UNAUTHORIZED'
        } satisfies ErrorResponse,
        { status: 401 }
      )
    }
    
    console.log('[Approve Submission] Admin verified')
    
    // ==================== FETCH SUBMISSION ====================
    const { data: submission, error: fetchError } = await supabase
      .from('project_submissions')
      .select('*, conversation_id')
      .eq('id', submissionId)
      .single()
    
    if (fetchError || !submission) {
      console.error('[Approve Submission] Submission not found:', fetchError?.message)
      return NextResponse.json(
        { 
          error: 'Submission not found',
          details: 'The specified submission does not exist',
          code: 'NOT_FOUND'
        } satisfies ErrorResponse,
        { status: 404 }
      )
    }
    
    console.log(`[Approve Submission] Found submission: ${submission.name}`)
    
    // ==================== VERIFY PENDING STATUS ====================
    if (submission.status !== 'pending') {
      console.warn(`[Approve Submission] Submission already ${submission.status}`)
      return NextResponse.json(
        { 
          error: 'Invalid submission status',
          details: `This submission has already been ${submission.status}`,
          code: 'INVALID_STATUS'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    console.log('[Approve Submission] Status verified as pending')
    
    // ==================== DETERMINE PROJECT CREATOR ====================
    // Use submitter wallet if available (new flow), fallback to admin wallet (legacy)
    const projectCreator = submission.submitter_wallet || adminWallet
    console.log(`[Approve Submission] Project creator will be: ${projectCreator.slice(0, 8)}... ${submission.submitter_wallet ? '(submitter)' : '(admin - legacy)'}`)
    
    // ==================== GENERATE CREATION TOKEN ====================
    const uniqueToken = generateCreationToken()
    console.log('[Approve Submission] Generated creation token')
    
    // ==================== CREATE PROJECT_CREATION_TOKEN RECORD ====================
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('project_creation_tokens')
      .insert({
        token: uniqueToken,
        contract_address: submission.contract_address,
        email: submission.email,
        submission_id: submissionId,
        created_by: projectCreator, // Use submitter wallet (or admin as fallback)
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: null // indefinite expiry
      })
      .select('id, token')
      .single()
    
    if (tokenError) {
      console.error('[Approve Submission] Error creating token:', tokenError.message)
      return NextResponse.json(
        { 
          error: 'Failed to create creation token',
          details: 'Database error occurred',
          code: 'TOKEN_CREATION_FAILED'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    console.log('[Approve Submission] Creation token record created')
    
    // ==================== UPDATE SUBMISSION STATUS ====================
    const { error: updateError } = await supabase
      .from('project_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminWallet
      })
      .eq('id', submissionId)
    
    if (updateError) {
      console.error('[Approve Submission] Error updating submission:', updateError.message)
      return NextResponse.json(
        { 
          error: 'Failed to update submission status',
          details: 'Database error occurred',
          code: 'STATUS_UPDATE_FAILED'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    console.log('[Approve Submission] Submission status updated to approved')
    
    // ==================== REMOVE PROJECT SUBMISSION TAG ====================
    if (submission.conversation_id) {
      const { error: tagError } = await supabase.rpc('remove_conversation_tag', {
        p_conversation_id: submission.conversation_id,
        p_tag: 'Project Submission'
      })
      
      if (tagError) {
        console.warn('[Approve Submission] Failed to remove tag (non-critical):', tagError.message)
      } else {
        console.log('[Approve Submission] Removed "Project Submission" tag')
      }
    }
    
    // ==================== SEND APPROVAL EMAIL ====================
    // Note: Approval is ONLY sent via email (not posted to conversation)
    // Send approval email to submitter
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'
      const creationLink = `${baseUrl}/projects/create?token=${uniqueToken}`
      
      // Import the direct email function
      const { sendEmailDirect } = await import('@/app/api/emails/send/route')
      
      const emailResult = await sendEmailDirect({
          type: 'project_approved',
          to: submission.email,
          data: {
            submitterName: submission.name,
            tokenSymbol: submission.token_symbol,
            tokenName: submission.token_name,
            creationLink
          }
      })
      
      if (emailResult.success) {
        console.log('[Approve Submission] ✅ Approval email sent to submitter:', emailResult.messageId)
      } else {
        console.warn('[Approve Submission] Approval email failed:', emailResult.error, emailResult.details)
      }
    } catch (emailError) {
      // Don't fail approval if email fails
      console.error('[Approve Submission] Failed to send approval email (non-critical):', emailError)
    }
    
    // ==================== BUILD RESPONSE ====================
    const creationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'}/projects/create?token=${uniqueToken}`
    
    const duration = Date.now() - startTime
    console.log(`[Approve Submission] ✅ Success! Completed in ${duration}ms`)
    console.log(`[Approve Submission] Creation link: ${creationLink}`)
    
    return NextResponse.json({
      success: true,
      token: uniqueToken,
      creationLink
    } satisfies ApproveSubmissionResponse)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Approve Submission] ❌ Unexpected error after ${duration}ms:`, error)
    
    if (error instanceof Error) {
      console.error('[Approve Submission] Error name:', error.name)
      console.error('[Approve Submission] Error message:', error.message)
      console.error('[Approve Submission] Error stack:', error.stack)
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
