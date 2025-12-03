'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Avatar,
  Paper,
  Link as MuiLink,
  Skeleton,
  Alert
} from '@mui/material'
import LaunchIcon from '@mui/icons-material/Launch'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LockIcon from '@mui/icons-material/Lock'
import CommentIcon from '@mui/icons-material/Comment'
import { Database } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { WalletAddressWithButtons } from './WalletAddressWithButtons'
import ContestSubmissionDetailModal from './ContestSubmissionDetailModal'

type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface ContestSubmissionGalleryProps {
  jobId: string
  isVisible: boolean
  isPoster: boolean
  userWallet?: string
  tokenSymbol?: string
}

export default function ContestSubmissionGallery({
  jobId,
  isVisible,
  isPoster,
  userWallet,
  tokenSymbol = 'tokens'
}: ContestSubmissionGalleryProps) {
  const [submissions, setSubmissions] = useState<JobSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<JobSubmission | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  
  // Real-time subscription ref
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    loadSubmissions()

    // Set up real-time subscription for live updates
    channelRef.current = supabase
      .channel(`contest-submissions-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_submissions',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log('[ContestSubmissionGallery] New submission received:', payload)
          // Add new submission to state (at the beginning for newest first)
          setSubmissions(prev => [payload.new as JobSubmission, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_submissions',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log('[ContestSubmissionGallery] Submission updated:', payload)
          // Update submission in state (for winner selection)
          setSubmissions(prev => 
            prev.map(s => s.id === (payload.new as JobSubmission).id ? payload.new as JobSubmission : s)
          )
        }
      )
      .subscribe((status) => {
        console.log('[ContestSubmissionGallery] Subscription status:', status)
      })

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        console.log('[ContestSubmissionGallery] Cleaning up subscription')
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [jobId])

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_submissions')
        .select('*')
        .eq('job_id', jobId)
        .order('submitted_at', { ascending: false })

      if (error) throw error
      setSubmissions(data || [])
      
      // Fetch comment counts for each submission
      if (data && data.length > 0) {
        const counts: Record<string, number> = {}
        for (const submission of data) {
          const { count } = await supabase
            .from('submission_comments')
            .select('*', { count: 'exact', head: true })
            .eq('submission_id', submission.id)
          counts[submission.id] = count || 0
        }
        setCommentCounts(counts)
      }
    } catch (error) {
      console.error('Error loading submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenSubmission = (submission: JobSubmission) => {
    setSelectedSubmission(submission)
    setDetailModalOpen(true)
  }

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false)
    setSelectedSubmission(null)
    // Refresh comment counts after closing modal
    loadSubmissions()
  }

  // Filter submissions based on visibility
  const visibleSubmissions = isPoster 
    ? submissions // Poster always sees all submissions
    : isVisible 
      ? submissions // Public: everyone sees all
      : submissions.filter(s => s.worker_wallet === userWallet) // Private: only your own

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getWinnerLabel = (position: number | null) => {
    if (!position) return ''
    if (position === 1) return '🥇 1st Place'
    if (position === 2) return '🥈 2nd Place'
    if (position === 3) return '🥉 3rd Place'
    return `#${position} Winner`
  }

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} md={6} key={i}>
            <Skeleton 
              variant="rectangular" 
              height={300} 
              sx={{ borderRadius: 'var(--radius-card-lg, 24px)' }}
            />
          </Grid>
        ))}
      </Grid>
    )
  }

  if (visibleSubmissions.length === 0) {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          p: 6, 
          textAlign: 'center', 
          bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
          borderRadius: 'var(--radius-card-lg, 24px)'
        }}
      >
        {!isVisible && !isPoster ? (
          <>
            <LockIcon sx={{ fontSize: 48, color: 'var(--accent-primary, #7C4DFF)', mb: 2 }} />
            <Typography 
              variant="h6" 
              sx={{ 
                color: 'var(--text-primary, #1A1A1E)', 
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                mb: 1 
              }}
            >
              Submissions are private
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }}
            >
              The contest creator has hidden submissions until judging begins
            </Typography>
          </>
        ) : (
          <>
            <EmojiEventsIcon sx={{ fontSize: 48, color: 'var(--accent-primary, #7C4DFF)', mb: 2 }} />
            <Typography 
              variant="h6" 
              sx={{ 
                color: 'var(--text-primary, #1A1A1E)', 
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                mb: 1 
              }}
            >
              No submissions yet
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }}
            >
              Be the first to submit your entry!
            </Typography>
          </>
        )}
      </Paper>
    )
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="h5" 
          sx={{ 
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontWeight: 600, 
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1 
          }}
        >
          Contest Entries ({visibleSubmissions.length})
        </Typography>
        
        {!isVisible && !isPoster && (
          <Alert 
            severity="info" 
            icon={<LockIcon />}
            sx={{ 
              mb: 2,
              borderRadius: 'var(--radius-card-lg, 24px)',
              '& .MuiAlert-message': {
                fontFamily: 'var(--font-body, Satoshi, sans-serif)'
              }
            }}
          >
            Submissions are private. You can only see your own entry.
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        {visibleSubmissions.map((submission) => (
          <Grid item xs={12} md={6} key={submission.id}>
            <Card 
              onClick={() => handleOpenSubmission(submission)}
              sx={{ 
                height: '100%',
                borderRadius: 'var(--radius-card-lg, 24px)',
                boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
                border: submission.is_selected_winner 
                  ? '3px solid var(--accent-warning, #FFC857)' 
                  : '1px solid var(--border-subtle, #E5E7F0)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 'var(--shadow-floating, 0 24px 60px 0 rgba(15, 23, 42, 0.10))'
                }
              }}
            >
              {/* Winner Badge */}
              {submission.is_selected_winner && (
                <Chip
                  icon={<EmojiEventsIcon sx={{ color: '#1A1A1E !important' }} />}
                  label={getWinnerLabel(submission.winner_position)}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 1,
                    bgcolor: 'var(--accent-warning, #FFC857)',
                    color: '#1A1A1E',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-control, 999px)'
                  }}
                />
              )}

              {/* Image Gallery */}
              {submission.image_urls && submission.image_urls.length > 0 && (
                <Box sx={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                  <CardMedia
                    component="img"
                    image={submission.image_urls[0]}
                    alt="Submission"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'opacity 0.2s ease',
                      '&:hover': { opacity: 0.9 }
                    }}
                  />
                  {submission.image_urls.length > 1 && (
                    <Chip
                      label={`+${submission.image_urls.length - 1} more`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 12,
                        right: 12,
                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                        fontWeight: 500,
                        borderRadius: 'var(--radius-control, 999px)'
                      }}
                    />
                  )}
                </Box>
              )}

              <CardContent sx={{ p: 'var(--space-lg, 24px)' }}>
                {/* Submitter Info */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      width: 36, 
                      height: 36, 
                      bgcolor: 'var(--accent-primary, #7C4DFF)',
                      fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    {submission.worker_wallet.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <WalletAddressWithButtons
                      address={submission.worker_wallet}
                      variant="short"
                      showCopy
                      showTip
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: 'var(--text-muted, #A3A7B5)' }} />
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'var(--text-muted, #A3A7B5)',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                        }}
                      >
                        {formatTimeAgo(submission.submitted_at)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Submission Description */}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mb: 2,
                    color: 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {submission.message}
                </Typography>

                {/* External Links */}
                {submission.external_links && submission.external_links.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {submission.external_links.map((link, index) => (
                      <MuiLink
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          color: 'var(--accent-primary, #7C4DFF)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                          fontSize: '13px',
                          fontWeight: 500,
                          px: 1.5,
                          py: 0.5,
                          bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                          borderRadius: 'var(--radius-control, 999px)',
                          transition: 'background-color 0.2s ease',
                          '&:hover': { 
                            bgcolor: 'rgba(124, 77, 255, 0.15)',
                            textDecoration: 'none'
                          }
                        }}
                      >
                        <LaunchIcon sx={{ fontSize: 14 }} />
                        Link {index + 1}
                      </MuiLink>
                    ))}
                  </Box>
                )}

                {/* Comment Count */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  mt: 2,
                  color: 'var(--text-secondary, #6F7280)'
                }}>
                  <CommentIcon sx={{ fontSize: 16 }} />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontWeight: 500
                    }}
                  >
                    {commentCounts[submission.id] || 0} comments
                  </Typography>
                </Box>

                {/* Prize Info for Winners */}
                {submission.is_selected_winner && submission.prize_amount_tokens && (
                  <Box sx={{ 
                    mt: 2, 
                    p: 2, 
                    bgcolor: 'rgba(255, 200, 87, 0.1)',
                    borderRadius: 'var(--radius-card, 16px)',
                    border: '1px solid var(--accent-warning, #FFC857)'
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                        fontWeight: 600,
                        color: 'var(--text-primary, #1A1A1E)'
                      }}
                    >
                      🎁 Prize: {submission.prize_amount_tokens.toLocaleString()} {tokenSymbol}
                    </Typography>
                    {submission.prize_amount_usd && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'var(--text-secondary, #6F7280)',
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                        }}
                      >
                        ≈ ${submission.prize_amount_usd.toLocaleString()} USD
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Submission Detail Modal */}
      <ContestSubmissionDetailModal
        open={detailModalOpen}
        onClose={handleCloseDetailModal}
        submission={selectedSubmission}
        tokenSymbol={tokenSymbol}
      />
    </>
  )
}

