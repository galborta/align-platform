'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Link as MuiLink
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface PaidSubmission {
  id: string
  worker_wallet: string
  social_follower_count: number
  social_payment_amount_usd: number
  social_payment_amount_tokens: number
  social_payment_tx_signature: string
  social_approval_status: string
  submitted_at: string
  social_paid_at: string | null
  social_tweet_link: string | null
}

interface PaidSubmissionsManagerProps {
  jobId: string
}

export default function PaidSubmissionsManager({
  jobId
}: PaidSubmissionsManagerProps) {
  const [submissions, setSubmissions] = useState<PaidSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPaidSubmissions = async () => {
    setLoading(true)
    try {
      // Fetch all submissions that have been successfully paid
      const { data, error } = await supabase
        .from('job_submissions')
        .select('*')
        .eq('job_id', jobId)
        .eq('social_approval_status', 'approved')
        .not('social_payment_tx_signature', 'is', null)
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('[PaidSubmissionsManager] Query error:', error)
        throw error
      }

      console.log('[PaidSubmissionsManager] Found paid submissions:', data?.length || 0)
      if (data && data.length > 0) {
        console.log('[PaidSubmissionsManager] First submission:', {
          id: data[0].id,
          status: data[0].social_approval_status,
          has_signature: !!data[0].social_payment_tx_signature,
          signature: data[0].social_payment_tx_signature?.slice(0, 16)
        })
      }

      setSubmissions(data || [])
    } catch (error: any) {
      console.error('Error fetching paid submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaidSubmissions()
  }, [jobId])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (submissions.length === 0) {
    return (
      <Alert severity="info">
        No paid submissions yet. Approved submissions will appear here once payment is complete.
      </Alert>
    )
  }

  return (
    <Box>
      <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {submissions.length} submission{submissions.length > 1 ? 's' : ''} successfully paid
        </Typography>
        <Typography variant="caption">
          All payments have been processed and recorded on the blockchain.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {submissions.map((submission) => (
          <Card key={submission.id} sx={{ bgcolor: '#FAFAFA' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5, fontWeight: 600 }}>
                    {submission.worker_wallet.slice(0, 8)}...{submission.worker_wallet.slice(-6)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label="✓ Paid"
                      size="small"
                      sx={{
                        bgcolor: 'var(--accent-success, #36C170)',
                        color: '#FFFFFF',
                        fontWeight: 600
                      }}
                    />
                    <Chip
                      label={`${submission.social_follower_count?.toLocaleString() || 0} followers`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  
                  {/* Payment Amount */}
                  <Typography variant="body2" sx={{ color: 'var(--accent-success, #36C170)', fontWeight: 700, mb: 0.5 }}>
                    {submission.social_payment_amount_tokens?.toFixed(2) || '0'} tokens
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    ${submission.social_payment_amount_usd?.toFixed(2) || '0.00'} USD
                  </Typography>

                  {/* Transaction Link */}
                  {submission.social_payment_tx_signature && (
                    <Box sx={{ mb: 1 }}>
                      <MuiLink
                        href={`https://solscan.io/tx/${submission.social_payment_tx_signature}?cluster=mainnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          color: 'var(--accent-success, #36C170)',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        🔗 {submission.social_payment_tx_signature.slice(0, 8)}...{submission.social_payment_tx_signature.slice(-6)}
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </MuiLink>
                    </Box>
                  )}

                  {/* Tweet Link */}
                  {submission.social_tweet_link && (
                    <Box sx={{ mb: 1 }}>
                      <MuiLink
                        href={submission.social_tweet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          fontSize: '13px',
                          color: 'var(--accent-primary, #7C4DFF)',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        View Tweet
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </MuiLink>
                    </Box>
                  )}

                  {/* Timestamps */}
                  <Typography variant="caption" color="text.secondary">
                    Submitted {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                    {submission.social_paid_at && (
                      <> • Paid {formatDistanceToNow(new Date(submission.social_paid_at), { addSuffix: true })}</>
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
