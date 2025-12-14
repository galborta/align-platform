/**
 * POST /api/submissions/check-duplicate
 * 
 * Checks if a contract address already exists in the projects or submissions tables
 * to prevent duplicate project submissions.
 * 
 * @module app/api/submissions/check-duplicate
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateSolanaAddress } from '@/lib/token-validation'
import { rateLimit } from '@/lib/rate-limit'

// ==================== TYPES ====================

interface CheckDuplicateRequest {
  contractAddress: string
}

interface CheckDuplicateResponse {
  isDuplicate: boolean
  reason?: 'existing_project' | 'pending_submission' | 'approved_submission'
  projectId?: string
  submissionId?: string
  message?: string
}

interface ErrorResponse {
  error: string
  details?: string
}

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

// ==================== MAIN HANDLER ====================

/**
 * POST /api/submissions/check-duplicate
 * 
 * Request body:
 * - contractAddress: string (required) - Token mint/contract address
 * 
 * Response:
 * - isDuplicate: boolean
 * - reason?: 'existing_project' | 'pending_submission' | 'approved_submission'
 * - projectId?: string (if existing project found)
 * - submissionId?: string (if pending/approved submission found)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ==================== PARSE REQUEST ====================
    let body: CheckDuplicateRequest
    try {
      body = await request.json()
    } catch {
      console.warn('[Check Duplicate] Invalid JSON in request body')
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: 'Request body must be valid JSON'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const { contractAddress } = body
    
    // ==================== VALIDATE INPUT ====================
    if (!contractAddress) {
      console.warn('[Check Duplicate] Missing contractAddress parameter')
      return NextResponse.json(
        { 
          error: 'Contract address is required',
          details: 'Request body must include contractAddress field'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    if (typeof contractAddress !== 'string') {
      console.warn('[Check Duplicate] contractAddress is not a string')
      return NextResponse.json(
        { 
          error: 'Contract address must be a string',
          details: 'contractAddress field must be a string value'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const trimmedAddress = contractAddress.trim()
    
    if (trimmedAddress.length === 0) {
      console.warn('[Check Duplicate] Empty contractAddress')
      return NextResponse.json(
        { 
          error: 'Contract address cannot be empty',
          details: 'Please provide a valid contract address'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    // Validate Solana address format
    if (!validateSolanaAddress(trimmedAddress)) {
      console.warn(`[Check Duplicate] Invalid Solana address format: ${trimmedAddress.slice(0, 8)}...`)
      return NextResponse.json(
        { 
          error: 'Invalid Solana address format',
          details: 'Contract address must be a valid Solana address'
        } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    
    const addressPreview = `${trimmedAddress.slice(0, 8)}...${trimmedAddress.slice(-4)}`
    console.log(`[Check Duplicate] Checking for duplicates: ${addressPreview}`)
    
    // ==================== RATE LIMITING ====================
    const clientIP = getClientIP(request)
    const rateLimitResult = rateLimit(clientIP, 'submission')
    
    if (!rateLimitResult.success) {
      console.warn(`[Check Duplicate] Rate limit exceeded for IP: ${clientIP}`)
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Rate limit exceeded',
          details: 'Too many requests. Please try again later.'
        } satisfies ErrorResponse,
        { status: rateLimitResult.status || 429 }
      )
    }
    
    // ==================== CHECK 1: EXISTING PROJECTS ====================
    console.log('[Check Duplicate] Step 1: Checking projects table...')
    
    const { data: existingProject, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('token_mint', trimmedAddress)
      .eq('status', 'live')
      .maybeSingle()
    
    if (projectError) {
      console.error('[Check Duplicate] Projects table query error:', projectError.message)
      return NextResponse.json(
        { 
          error: 'Database error',
          details: 'Failed to check for existing projects'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    if (existingProject) {
      const duration = Date.now() - startTime
      console.log(`[Check Duplicate] ✅ Found existing live project: ${existingProject.id}`)
      console.log(`[Check Duplicate] Completed in ${duration}ms`)
      
      return NextResponse.json({
        isDuplicate: true,
        reason: 'existing_project',
        projectId: existingProject.id,
        message: 'This token already has a live project on Orggly'
      } satisfies CheckDuplicateResponse)
    }
    
    console.log('[Check Duplicate] No existing live project found')
    
    // ==================== CHECK 2: PENDING/APPROVED SUBMISSIONS ====================
    console.log('[Check Duplicate] Step 2: Checking project_submissions table...')
    
    const { data: existingSubmission, error: submissionError } = await supabase
      .from('project_submissions')
      .select('id, status')
      .eq('contract_address', trimmedAddress)
      .in('status', ['pending', 'approved'])
      .maybeSingle()
    
    if (submissionError) {
      console.error('[Check Duplicate] Submissions table query error:', submissionError.message)
      return NextResponse.json(
        { 
          error: 'Database error',
          details: 'Failed to check for existing submissions'
        } satisfies ErrorResponse,
        { status: 500 }
      )
    }
    
    if (existingSubmission) {
      const duration = Date.now() - startTime
      const reason = existingSubmission.status === 'pending' 
        ? 'pending_submission' 
        : 'approved_submission'
      
      console.log(`[Check Duplicate] ✅ Found ${existingSubmission.status} submission: ${existingSubmission.id}`)
      console.log(`[Check Duplicate] Completed in ${duration}ms`)
      
      const message = existingSubmission.status === 'pending'
        ? 'A submission for this token is already pending review'
        : 'This token has been approved and is awaiting project creation'
      
      return NextResponse.json({
        isDuplicate: true,
        reason,
        submissionId: existingSubmission.id,
        message
      } satisfies CheckDuplicateResponse)
    }
    
    console.log('[Check Duplicate] No existing submission found')
    
    // ==================== NO DUPLICATES FOUND ====================
    const duration = Date.now() - startTime
    console.log(`[Check Duplicate] ✅ No duplicates found for ${addressPreview}`)
    console.log(`[Check Duplicate] Completed in ${duration}ms`)
    
    return NextResponse.json({
      isDuplicate: false,
      message: 'No duplicates found. You may proceed with submission.'
    } satisfies CheckDuplicateResponse)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Check Duplicate] ❌ Unexpected error after ${duration}ms:`, error)
    
    if (error instanceof Error) {
      console.error('[Check Duplicate] Error name:', error.name)
      console.error('[Check Duplicate] Error message:', error.message)
      console.error('[Check Duplicate] Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred while checking for duplicates'
      } satisfies ErrorResponse,
      { status: 500 }
    )
  }
}

// ==================== UNSUPPORTED METHODS ====================

/**
 * Handle unsupported methods
 */
export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      details: 'This endpoint only supports POST requests'
    } satisfies ErrorResponse,
    { status: 405 }
  )
}
