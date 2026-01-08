/**
 * Example Integration: Submission Modal with Budget Exhaustion Handling
 * 
 * This example shows how to integrate all submission-related modals:
 * 1. SubmissionModal - Worker fills out application
 * 2. SubmissionSuccessModal - Shown on successful submission
 * 3. BudgetExhaustedModal - Shown when budget runs out
 * 
 * Use this pattern in your job detail pages or job listing cards.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@mui/material'
import {
  SubmissionModal,
  SubmissionSuccessModal,
  BudgetExhaustedModal
} from '@/components/jobs/social'
import type { Database } from '@/types/database'

type Job = Database['public']['Tables']['jobs']['Row']

interface SocialJobSubmissionFlowProps {
  job: Job
  walletAddress?: string
  signMessage?: (message: string) => Promise<string>
}

export default function SocialJobSubmissionFlow({
  job,
  walletAddress,
  signMessage
}: SocialJobSubmissionFlowProps) {
  const router = useRouter()
  
  // Modal states
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showBudgetExhaustedModal, setShowBudgetExhaustedModal] = useState(false)
  
  // Data states
  const [successData, setSuccessData] = useState<any>(null)
  
  /**
   * Handle submission success
   * Called when API returns 200 with submission data
   */
  function handleSubmissionSuccess(submissionId: string) {
    // TODO: Get full API response with payment_reserved, auto_approve_date, etc.
    // For now using mock data
    
    // Close submission modal
    setShowSubmissionModal(false)
    
    // Prepare success data
    setSuccessData({
      payment_amount: 25.00, // From API response
      auto_approve_date: job.social_review_deadline || job.social_campaign_end_date,
      job_title: job.title,
      enable_impression_bonuses: job.enable_impression_bonuses || false
    })
    
    // Show success modal
    setShowSuccessModal(true)
  }
  
  /**
   * Handle submission error
   * Called when API returns error
   */
  function handleSubmissionError(errorType: string) {
    if (errorType === 'budget_exhausted') {
      // Close submission modal
      setShowSubmissionModal(false)
      
      // Show budget exhausted modal
      setShowBudgetExhaustedModal(true)
    }
    // Other errors are handled by SubmissionModal internally
  }
  
  /**
   * Handle view submission
   * Called when user clicks "View My Submission" in success modal
   */
  function handleViewSubmission() {
    setShowSuccessModal(false)
    // TODO: Navigate to submission tracking page when built
    // For now, navigate to job detail or submissions list
    router.push(`/submissions`) // Or `/project/${job.project_id}/jobs/${job.id}`
  }
  
  return (
    <>
      {/* Apply Button */}
      <Button
        variant="contained"
        onClick={() => setShowSubmissionModal(true)}
        disabled={!walletAddress}
        sx={{
          bgcolor: 'var(--accent-primary, #7C4DFF)',
          color: '#FFFFFF',
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: 'var(--text-label, 14px)',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 'var(--radius-control, 999px)',
          py: 1.25,
          px: 3,
          '&:hover': {
            bgcolor: '#6B3FEE'
          },
          '&:disabled': {
            bgcolor: 'var(--icon-default, #B6BAC7)',
            color: '#FFFFFF'
          }
        }}
      >
        {walletAddress ? 'Apply to Campaign' : 'Connect Wallet to Apply'}
      </Button>
      
      {/* Step 1: Submission Form Modal */}
      <SubmissionModal
        open={showSubmissionModal}
        job={job}
        onClose={() => setShowSubmissionModal(false)}
        onSuccess={handleSubmissionSuccess}
        walletAddress={walletAddress}
        signMessage={signMessage}
      />
      
      {/* Step 2: Success Confirmation Modal */}
      {successData && (
        <SubmissionSuccessModal
          open={showSuccessModal}
          submission={successData}
          onClose={() => setShowSuccessModal(false)}
          onViewSubmission={handleViewSubmission}
        />
      )}
      
      {/* Step 3: Budget Exhausted Modal (Error Case) */}
      <BudgetExhaustedModal
        open={showBudgetExhaustedModal}
        job={job}
        onClose={() => setShowBudgetExhaustedModal(false)}
      />
    </>
  )
}

