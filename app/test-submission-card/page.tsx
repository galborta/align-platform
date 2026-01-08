'use client'

import SubmissionReviewCard from '@/components/jobs/social/SubmissionReviewCard'
import { Box, Container, Typography } from '@mui/material'

/**
 * Test page for SubmissionReviewCard component
 * 
 * Navigate to /test-submission-card to view
 */
export default function TestSubmissionCardPage() {
  // Mock data for testing
  const mockJob = {
    id: 'test-job-123',
    title: 'Test Social Campaign',
    social_enable_impression_bonuses: true,
    social_total_budget_tokens: 1000,
    social_total_budget_usd: 1000,
  } as any

  const mockSubmissions = [
    {
      id: 'sub-1',
      job_id: 'test-job-123',
      worker_wallet: '5xK3abc123def456ghi789jklm9P2',
      social_follower_count: 15000,
      social_follower_count_verified: 15000,
      social_payment_amount_usd: 75,
      social_payment_amount_tokens: 75,
      social_tweet_url: 'https://twitter.com/user/status/1234567890',
      social_approval_status: 'pending',
      submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    },
    {
      id: 'sub-2',
      job_id: 'test-job-123',
      worker_wallet: '9zX4def456ghi789jkl123mno8Q7',
      social_follower_count: 8500,
      social_follower_count_verified: 8500,
      social_payment_amount_usd: 50,
      social_payment_amount_tokens: 50,
      social_tweet_url: 'https://twitter.com/anotheruser/status/9876543210',
      social_approval_status: 'pending',
      submitted_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    },
    {
      id: 'sub-3',
      job_id: 'test-job-123',
      worker_wallet: '3aB1xyz789abc123def456ghi2C5',
      social_follower_count: 125000,
      social_follower_count_verified: 125000,
      social_payment_amount_usd: 150,
      social_payment_amount_tokens: 150,
      social_tweet_url: 'https://twitter.com/biginfluencer/status/5555555555',
      social_approval_status: 'approved',
      submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    },
  ] as any[]

  const handleSelect = (id: string, selected: boolean) => {
    console.log(`Selection changed: ${id} -> ${selected}`)
  }

  const handleApprove = async (submissionId: string, impressions: number) => {
    console.log(`Approve submission ${submissionId} with ${impressions} impressions`)
    alert(`Would approve submission ${submissionId} with ${impressions} impressions`)
  }

  const handleReject = async (submissionId: string) => {
    console.log(`Reject submission ${submissionId}`)
    if (confirm(`Are you sure you want to reject this submission?`)) {
      alert(`Would reject submission ${submissionId}`)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h1" sx={{ mb: 4, fontFamily: 'var(--font-heading)', fontSize: '32px' }}>
        Submission Review Card - Test Page
      </Typography>

      <Typography variant="body1" sx={{ mb: 3, color: 'var(--text-secondary)' }}>
        Test the SubmissionReviewCard component with various states:
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, fontFamily: 'var(--font-heading)', fontSize: '24px' }}>
          Pending Submissions (with impression bonuses)
        </Typography>
        
        {mockSubmissions.slice(0, 2).map((submission, index) => (
          <SubmissionReviewCard
            key={submission.id}
            submission={submission}
            job={mockJob}
            isSelected={index === 0} // First one is selected
            onSelect={handleSelect}
            onApprove={handleApprove}
            onReject={handleReject}
            index={index}
          />
        ))}
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, fontFamily: 'var(--font-heading)', fontSize: '24px' }}>
          Approved Submission
        </Typography>
        
        <SubmissionReviewCard
          submission={mockSubmissions[2]}
          job={mockJob}
          isSelected={false}
          onSelect={handleSelect}
          onApprove={handleApprove}
          onReject={handleReject}
          index={2}
        />
      </Box>

      <Typography variant="body2" sx={{ mt: 4, p: 2, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-card-md)' }}>
        💡 <strong>Testing Instructions:</strong><br />
        1. Check that follower counts are correctly formatted (K/M notation)<br />
        2. Try entering impression values in the text field<br />
        3. Verify bonus calculation updates in real-time (CPM = $5/1000 impressions)<br />
        4. Test approve/reject buttons (should show console logs)<br />
        5. Verify selection state (purple border when selected)<br />
        6. Check responsive layout on mobile
      </Typography>
    </Container>
  )
}

