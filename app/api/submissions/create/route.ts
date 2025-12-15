/**
 * POST /api/submissions/create
 * 
 * Creates a new project submission record after validation.
 * 
 * @module app/api/submissions/create
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateSolanaAddress } from '@/lib/token-validation'
import { rateLimit } from '@/lib/rate-limit'
import { ADMIN_WALLETS } from '@/lib/admin-auth'
import { notificationService } from '@/lib/services/notificationService'

// ==================== TYPES ====================

interface CreateSubmissionRequest {
  name: string
  email: string
  contractAddress: string
  tokenSymbol: string
  tokenName: string
  role: string
  message?: string
}

interface CreateSubmissionResponse {
  success: boolean
  submissionId: string
  conversationId?: string
}

interface ErrorResponse {
  error: string
  details?: string
  code?: string
}

// ==================== CONSTANTS ====================

const VALID_ROLES = [
  'Founder',
  'Team Member',
  'Community Member',
  'Investor',
  'Other'
] as const

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// System identifier for project submission conversations
const SUBMISSION_SYSTEM_ID = 'project-submissions'

// ==================== HELPERS ====================

/**
 * Extract client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP.trim()
  }
  
  return 'unknown'
}

/**
 * Check if submission is duplicate in projects or submissions tables
 */
async function checkForDuplicates(contractAddress: string): Promise<{
  isDuplicate: boolean
  reason?: string
}> {
  // Check existing live projects
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('token_mint', contractAddress)
    .eq('status', 'live')
    .maybeSingle()
  
  if (existingProject) {
    return { isDuplicate: true, reason: 'existing_project' }
  }
  
  // Check pending/approved submissions
  const { data: existingSubmission } = await supabase
    .from('project_submissions')
    .select('id, status')
    .eq('contract_address', contractAddress)
    .in('status', ['pending', 'approved'])
    .maybeSingle()
  
  if (existingSubmission) {
    return { 
      isDuplicate: true, 
      reason: existingSubmission.status === 'pending' 
        ? 'pending_submission' 
        : 'approved_submission' 
    }
  }
  
  return { isDuplicate: false }
}

/**
 * Rate limit check for email address (max 3 submissions per hour)
 */
async function checkEmailRateLimit(email: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('project_submissions')
    .select('id')
    .eq('email', email.toLowerCase())
    .gte('submitted_at', oneHourAgo)
  
  if (error) {
    console.error('[Create Submission] Email rate limit check failed:', error.message)
    return false // Don't block on error
  }
  
  return (data?.length || 0) >= 3
}

/**
 * Create admin conversation for project submission
 * Creates conversation, adds tags, links submission, and posts initial message
 */
async function createAdminConversation(submissionData: {
  submissionId: string
  name: string
  email: string
  contractAddress: string
  tokenSymbol: string
  tokenName: string
  role: string
  message: string | null
  submittedAt: string
}): Promise<string | null> {
  try {
    // Get admin wallet (use first admin from the list)
    const adminWallet = ADMIN_WALLETS[0]
    
    if (!adminWallet) {
      console.error('[Create Submission] No admin wallet configured in ADMIN_WALLETS')
      return null
    }
    
    console.log('[Create Submission] Creating admin conversation...')
    
    // Step 1: Create or get conversation using database function
    // Order participants alphabetically as required by the database constraint
    const participant1 = adminWallet < SUBMISSION_SYSTEM_ID ? adminWallet : SUBMISSION_SYSTEM_ID
    const participant2 = adminWallet < SUBMISSION_SYSTEM_ID ? SUBMISSION_SYSTEM_ID : adminWallet
    
    const { data: conversationData, error: conversationError } = await supabase
      .rpc('get_or_create_conversation', {
        p_wallet_1: participant1,
        p_wallet_2: participant2
      })
    
    if (conversationError) {
      console.error('[Create Submission] Error creating conversation:', conversationError.message)
      return null
    }
    
    const conversationId = conversationData
    
    if (!conversationId) {
      console.error('[Create Submission] No conversation ID returned')
      return null
    }
    
    console.log(`[Create Submission] Conversation created/retrieved: ${conversationId}`)
    
    // Step 2: Add "Project Submission" tag to conversation
    const { error: tagError } = await supabase.rpc('add_conversation_tag', {
      p_conversation_id: conversationId,
      p_tag: 'Project Submission'
    })
    
    if (tagError) {
      console.warn('[Create Submission] RPC add_conversation_tag failed:', tagError.message)
      // Fallback: Directly update tags array
      console.log('[Create Submission] Attempting direct tag update fallback...')
      const { error: directTagError } = await supabase
        .from('conversations')
        .update({ tags: ['Project Submission'] })
        .eq('id', conversationId)
      
      if (directTagError) {
        console.error('[Create Submission] CRITICAL: Failed to add tag via fallback:', directTagError.message)
      } else {
        console.log('[Create Submission] ✓ Tag added via direct update fallback')
      }
    } else {
      console.log('[Create Submission] ✓ Added "Project Submission" tag via RPC')
    }
    
    // Step 3: Set submission_id on the conversation
    const { error: linkError } = await supabase
      .from('conversations')
      .update({ submission_id: submissionData.submissionId })
      .eq('id', conversationId)
    
    if (linkError) {
      console.warn('[Create Submission] Failed to link submission to conversation:', linkError.message)
    } else {
      console.log('[Create Submission] Linked submission to conversation')
    }
    
    // Step 4: Create initial message with submission details
    const messageContent = `🚀 New Project Submission

Name: ${submissionData.name}
Email: ${submissionData.email}
Token Contract: ${submissionData.contractAddress}
Token: ${submissionData.tokenSymbol} - ${submissionData.tokenName}
Role: ${submissionData.role}

Message:
${submissionData.message || 'No additional message provided'}

Submitted: ${new Date(submissionData.submittedAt).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    })}`
    
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_wallet: SUBMISSION_SYSTEM_ID,
        content: messageContent,
        created_at: new Date().toISOString()
      })
    
    if (messageError) {
      console.warn('[Create Submission] Failed to create initial message:', messageError.message)
    } else {
      console.log('[Create Submission] Created initial submission message')
    }
    
    // Step 5: Update submission record with conversation_id
    const { error: updateError } = await supabase
      .from('project_submissions')
      .update({ conversation_id: conversationId })
      .eq('id', submissionData.submissionId)
    
    if (updateError) {
      console.warn('[Create Submission] Failed to update submission with conversation_id:', updateError.message)
    } else {
      console.log('[Create Submission] Updated submission with conversation_id')
    }
    
    console.log('[Create Submission] ✅ Admin conversation setup complete')
    return conversationId
    
  } catch (error) {
    console.error('[Create Submission] Exception in createAdminConversation:', error)
    return null
  }
}

// ==================== MAIN HANDLER ====================

/**
 * POST /api/submissions/create
 * 
 * Request body:
 * - name: string (required, max 100 chars)
 * - email: string (required, valid email format)
 * - contractAddress: string (required, valid Solana address)
 * - tokenSymbol: string (required)
 * - tokenName: string (required)
 * - role: string (required, one of VALID_ROLES)
 * - message?: string (optional, max 500 chars)
 * 
 * Response:
 * - success: boolean
 * - submissionId: string
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ==================== PARSE REQUEST ====================
    let body: CreateSubmissionRequest
    try {
      body = await request.json()
    } catch {
      console.warn('[Create Submission] Invalid JSON in request body')
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: 'Request body must be valid JSON',
          code: 'INVALID_JSON'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const { name, email, contractAddress, tokenSymbol, tokenName, role, message } = body
    
    console.log('[Create Submission] New submission request received')
    console.log(`[Create Submission] Email: ${email?.slice(0, 3)}...@...`)
    
    // ==================== VALIDATE REQUIRED FIELDS ====================
    const missingFields: string[] = []
    
    if (!name || typeof name !== 'string') missingFields.push('name')
    if (!email || typeof email !== 'string') missingFields.push('email')
    if (!contractAddress || typeof contractAddress !== 'string') missingFields.push('contractAddress')
    if (!tokenSymbol || typeof tokenSymbol !== 'string') missingFields.push('tokenSymbol')
    if (!tokenName || typeof tokenName !== 'string') missingFields.push('tokenName')
    if (!role || typeof role !== 'string') missingFields.push('role')
    
    if (missingFields.length > 0) {
      console.warn(`[Create Submission] Missing required fields: ${missingFields.join(', ')}`)
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: `The following fields are required: ${missingFields.join(', ')}`,
          code: 'MISSING_FIELDS'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // ==================== VALIDATE FIELD VALUES ====================
    
    // Validate name length
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { 
          error: 'Name cannot be empty',
          code: 'INVALID_NAME'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    if (trimmedName.length > 100) {
      return NextResponse.json(
        { 
          error: 'Name is too long',
          details: 'Name must be 100 characters or less',
          code: 'INVALID_NAME'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Validate email format
    const trimmedEmail = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      console.warn(`[Create Submission] Invalid email format: ${trimmedEmail.slice(0, 3)}...`)
      return NextResponse.json(
        { 
          error: 'Invalid email format',
          details: 'Please provide a valid email address',
          code: 'INVALID_EMAIL'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Validate contract address
    const trimmedAddress = contractAddress.trim()
    if (!validateSolanaAddress(trimmedAddress)) {
      console.warn(`[Create Submission] Invalid Solana address: ${trimmedAddress.slice(0, 8)}...`)
      return NextResponse.json(
        { 
          error: 'Invalid contract address',
          details: 'Contract address must be a valid Solana address',
          code: 'INVALID_ADDRESS'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Validate role
    if (!VALID_ROLES.includes(role as any)) {
      console.warn(`[Create Submission] Invalid role: ${role}`)
      return NextResponse.json(
        { 
          error: 'Invalid role',
          details: `Role must be one of: ${VALID_ROLES.join(', ')}`,
          code: 'INVALID_ROLE'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Validate message length (if provided)
    if (message && message.length > 500) {
      return NextResponse.json(
        { 
          error: 'Message is too long',
          details: 'Message must be 500 characters or less',
          code: 'INVALID_MESSAGE'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const addressPreview = `${trimmedAddress.slice(0, 8)}...${trimmedAddress.slice(-4)}`
    console.log(`[Create Submission] Validation passed for ${addressPreview}`)
    
    // ==================== RATE LIMITING ====================
    const clientIP = getClientIP(request)
    const rateLimitResult = rateLimit(clientIP, 'submission')
    
    if (!rateLimitResult.success) {
      console.warn(`[Create Submission] Rate limit exceeded for IP: ${clientIP}`)
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Rate limit exceeded',
          details: 'Too many submission attempts. Please try again later.',
          code: 'RATE_LIMIT'
        } satisfies ErrorResponse,
        { status: 429 }
      )
    }
    
    // Check email-based rate limit (3 per hour)
    const emailRateLimitExceeded = await checkEmailRateLimit(trimmedEmail)
    if (emailRateLimitExceeded) {
      console.warn(`[Create Submission] Email rate limit exceeded: ${trimmedEmail.slice(0, 3)}...`)
      return NextResponse.json(
        { 
          error: 'Too many submissions',
          details: 'Maximum 3 submissions per hour per email address',
          code: 'EMAIL_RATE_LIMIT'
        } satisfies ErrorResponse,
        { status: 429 }
      )
    }
    
    // ==================== CHECK FOR DUPLICATES ====================
    console.log('[Create Submission] Checking for duplicates...')
    
    const duplicateCheck = await checkForDuplicates(trimmedAddress)
    
    if (duplicateCheck.isDuplicate) {
      console.warn(`[Create Submission] Duplicate found: ${duplicateCheck.reason}`)
      
      let errorMessage = 'This project has already been submitted'
      if (duplicateCheck.reason === 'existing_project') {
        errorMessage = 'This project already exists on Orggly'
      } else if (duplicateCheck.reason === 'pending_submission') {
        errorMessage = 'A submission for this project is already pending review'
      } else if (duplicateCheck.reason === 'approved_submission') {
        errorMessage = 'This project has been approved and is being set up'
      }
      
      return NextResponse.json(
        { 
          error: 'Duplicate submission',
          details: errorMessage,
          code: 'DUPLICATE'
        } satisfies ErrorResponse,
        { status: 409 }
      )
    }
    
    console.log('[Create Submission] No duplicates found, proceeding with insert')
    
    // ==================== INSERT SUBMISSION ====================
    const { data: submission, error: insertError } = await supabase
      .from('project_submissions')
      .insert([{
        name: trimmedName,
        email: trimmedEmail,
        contract_address: trimmedAddress,
        token_symbol: tokenSymbol,
        token_name: tokenName,
        role: role,
        message: message?.trim() || null,
        status: 'pending'
      }])
      .select('id')
      .single()
    
    if (insertError) {
      console.error('[Create Submission] Database insert error:', insertError.message)
      console.error('[Create Submission] Error code:', insertError.code)
      
      // Check for unique constraint violation (shouldn't happen after duplicate check, but just in case)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { 
            error: 'Duplicate submission',
            details: 'This submission already exists',
            code: 'DUPLICATE'
          } satisfies ErrorResponse,
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create submission',
          details: 'Database error occurred',
          code: 'DATABASE_ERROR'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    if (!submission) {
      console.error('[Create Submission] No submission data returned')
      return NextResponse.json(
        { 
          error: 'Failed to create submission',
          details: 'No data returned from database',
          code: 'NO_DATA'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    // ==================== BACKGROUND PROCESSING ====================
    // Process everything else asynchronously in the background
    // This allows us to return success to the user immediately
    console.log('[Create Submission] Starting background processing for submission:', submission.id)
    processSubmissionBackground(submission.id, {
      name: trimmedName,
      email: trimmedEmail,
      contractAddress: trimmedAddress,
      tokenSymbol,
      tokenName,
      role,
      message: message?.trim() || null
    }).catch(error => {
      // Log background processing errors but don't fail the request
      console.error('[Create Submission] ❌ Background processing error:', error)
      if (error instanceof Error) {
        console.error('[Create Submission] ❌ Error stack:', error.stack)
      }
    })
    
    const duration = Date.now() - startTime
    console.log(`[Create Submission] ✅ Success! Submission ID: ${submission.id}`)
    console.log(`[Create Submission] User response sent in ${duration}ms`)
    console.log('[Create Submission] Background processing started (conversation, notifications, emails)')
    
    return NextResponse.json({
      success: true,
      submissionId: submission.id
    } satisfies CreateSubmissionResponse)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Create Submission] ❌ Unexpected error after ${duration}ms:`, error)
    
    if (error instanceof Error) {
      console.error('[Create Submission] Error name:', error.name)
      console.error('[Create Submission] Error message:', error.message)
      console.error('[Create Submission] Error stack:', error.stack)
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

// ==================== BACKGROUND PROCESSING ====================

/**
 * Process submission-related tasks in the background
 * This runs asynchronously after returning success to the user
 */
async function processSubmissionBackground(
  submissionId: string,
  data: {
    name: string
    email: string
    contractAddress: string
    tokenSymbol: string
    tokenName: string
    role: string
    message: string | null
  }
) {
  const startTime = Date.now()
  console.log(`[Background] Starting background processing for submission: ${submissionId}`)
  
  let conversationId: string | null = null
  
  // ==================== CREATE ADMIN CONVERSATION ====================
  try {
    console.log('[Background] Creating admin conversation...')
    conversationId = await createAdminConversation({
      submissionId,
      name: data.name,
      email: data.email,
      contractAddress: data.contractAddress,
      tokenSymbol: data.tokenSymbol,
      tokenName: data.tokenName,
      role: data.role,
      message: data.message,
      submittedAt: new Date().toISOString()
    })
    
    if (conversationId) {
      console.log(`[Background] ✅ Admin conversation created: ${conversationId}`)
    }
  } catch (conversationError) {
    console.error('[Background] Failed to create admin conversation:', conversationError)
  }
  
  // ==================== CREATE ADMIN NOTIFICATION ====================
  try {
    console.log('[Background] Creating admin notification...')
    await notificationService.notifyAllAdmins({
      type: 'admin_asset_new',
      referenceId: submissionId,
      referenceType: 'submission',
      metadata: {
        submission_id: submissionId,
        token_symbol: data.tokenSymbol,
        token_name: data.tokenName,
        contract_address: data.contractAddress,
        submitter_name: data.name,
        submitter_email: data.email,
        submitter_role: data.role,
        conversation_id: conversationId || undefined,
        asset_name: `${data.tokenSymbol} - ${data.tokenName}`
      }
    })
    
    console.log('[Background] ✅ Admin notification created')
  } catch (notificationError) {
    console.error('[Background] Failed to create admin notification:', notificationError)
  }
  
  // ==================== SEND ADMIN EMAIL NOTIFICATION ====================
  // Support both ADMIN_EMAIL (singular) and ADMIN_EMAILS (comma-separated)
  const adminEmail = process.env.ADMIN_EMAIL
  const adminEmailsEnv = process.env.ADMIN_EMAILS
  const adminEmailsList: string[] = []
  
  console.log('[Background] Email configuration check:')
  console.log('[Background] - ADMIN_EMAIL:', adminEmail ? `${adminEmail.slice(0, 3)}***` : 'NOT SET')
  console.log('[Background] - ADMIN_EMAILS:', adminEmailsEnv ? `${adminEmailsEnv.slice(0, 10)}***` : 'NOT SET')
  console.log('[Background] - RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'NOT SET')
  console.log('[Background] - EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET')
  
  if (adminEmailsEnv) {
    // Parse comma-separated list
    adminEmailsList.push(...adminEmailsEnv.split(',').map(e => e.trim()).filter(Boolean))
  } else if (adminEmail) {
    // Fall back to single email
    adminEmailsList.push(adminEmail.trim())
  }
  
  if (adminEmailsList.length > 0) {
    try {
      console.log('[Background] 📧 Sending admin email to:', adminEmailsList.length, 'recipient(s)')
      console.log('[Background] 📧 Recipients:', adminEmailsList.map(e => e.slice(0, 3) + '***').join(', '))
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      
      // Import the direct email function
      const { sendEmailDirect } = await import('@/app/api/emails/send/route')
      
      const emailResult = await sendEmailDirect({
        type: 'admin_notification',
        to: adminEmailsList.length === 1 ? adminEmailsList[0] : adminEmailsList,
        data: {
          submitterName: data.name,
          submitterEmail: data.email,
          tokenSymbol: data.tokenSymbol,
          tokenName: data.tokenName,
          contractAddress: data.contractAddress,
          role: data.role,
          message: data.message || undefined,
          submittedAt: new Date().toLocaleString('en-US', {
            dateStyle: 'long',
            timeStyle: 'short'
          }),
          conversationUrl: conversationId ? `${baseUrl}/messages` : `${baseUrl}/admin`
        }
      })
      
      if (emailResult.success) {
        console.log('[Background] ✅ Admin email notification sent successfully!')
        console.log('[Background] ✅ Message ID:', emailResult.messageId)
        console.log('[Background] ✅ Check Resend dashboard: https://resend.com/emails')
      } else {
        console.error('[Background] ❌ Admin email failed!')
        console.error('[Background] ❌ Error:', emailResult.error)
        console.error('[Background] ❌ Details:', JSON.stringify(emailResult.details, null, 2))
      }
    } catch (emailError) {
      console.error('[Background] ❌ Exception sending admin notification email:')
      console.error('[Background] ❌ Error:', emailError)
      if (emailError instanceof Error) {
        console.error('[Background] ❌ Stack:', emailError.stack)
      }
    }
  } else {
    console.error('[Background] ❌ ADMIN_EMAIL or ADMIN_EMAILS not configured!')
    console.error('[Background] ❌ Set ADMIN_EMAIL=galborta@protonmail.com in your .env.local file')
    console.error('[Background] ❌ Skipping email notification')
  }
  
  const duration = Date.now() - startTime
  console.log(`[Background] ✅ Background processing completed in ${duration}ms`)
}

// ==================== UNSUPPORTED METHODS ====================

/**
 * Handle unsupported methods
 */
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
