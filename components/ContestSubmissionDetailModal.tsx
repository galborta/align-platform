'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Avatar,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Link as MuiLink
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LaunchIcon from '@mui/icons-material/Launch'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import ReplyIcon from '@mui/icons-material/Reply'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Database } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { useWallet } from '@solana/wallet-adapter-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { WalletAddressWithButtons } from './WalletAddressWithButtons'
import { 
  getSubmissionComments, 
  postSubmissionComment, 
  organizeComments,
  SubmissionComment,
  SubmissionCommentWithReplies 
} from '@/lib/submission-comments'

type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface ContestSubmissionDetailModalProps {
  open: boolean
  onClose: () => void
  submission: JobSubmission | null
  tokenSymbol?: string
}

export default function ContestSubmissionDetailModal({
  open,
  onClose,
  submission,
  tokenSymbol = 'tokens'
}: ContestSubmissionDetailModalProps) {
  const { publicKey } = useWallet()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [comments, setComments] = useState<SubmissionComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [posting, setPosting] = useState(false)
  const [postingReply, setPostingReply] = useState<string | null>(null)
  const [loadingComments, setLoadingComments] = useState(true)
  
  // Real-time subscription ref
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Reset state when submission changes
  useEffect(() => {
    if (submission) {
      setCurrentImageIndex(0)
      fetchComments()
      
      // Set up real-time subscription for comments
      channelRef.current = supabase
        .channel(`submission-comments-${submission.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'submission_comments',
            filter: `submission_id=eq.${submission.id}`
          },
          () => {
            fetchComments()
          }
        )
        .subscribe()
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [submission?.id])

  const fetchComments = async () => {
    if (!submission) return
    setLoadingComments(true)
    const data = await getSubmissionComments(submission.id)
    setComments(data)
    setLoadingComments(false)
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !publicKey || !submission || posting) return

    setPosting(true)
    try {
      const result = await postSubmissionComment(
        submission.id,
        submission.job_id,
        publicKey.toString(),
        newComment
      )

      if (result.success) {
        toast.success('Comment posted!')
        setNewComment('')
        await fetchComments()
      } else {
        toast.error(result.error || 'Failed to post comment')
      }
    } catch (error) {
      console.error('Error posting comment:', error)
      toast.error('Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    const replyText = replyTexts[parentId]?.trim()
    if (!replyText || !publicKey || !submission || postingReply) return

    setPostingReply(parentId)
    try {
      const result = await postSubmissionComment(
        submission.id,
        submission.job_id,
        publicKey.toString(),
        replyText,
        parentId
      )

      if (result.success) {
        toast.success('Reply posted!')
        setReplyTexts(prev => ({ ...prev, [parentId]: '' }))
        setReplyingTo(null)
        await fetchComments()
      } else {
        toast.error(result.error || 'Failed to post reply')
      }
    } catch (error) {
      console.error('Error posting reply:', error)
      toast.error('Failed to post reply')
    } finally {
      setPostingReply(null)
    }
  }

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const getWinnerLabel = (position: number | null) => {
    if (!position) return ''
    if (position === 1) return '🥇 1st Place'
    if (position === 2) return '🥈 2nd Place'
    if (position === 3) return '🥉 3rd Place'
    return `#${position} Winner`
  }

  const organizedComments = organizeComments(comments)

  const renderComment = (comment: SubmissionComment, isReply: boolean = false) => (
    <Box
      key={comment.id}
      sx={{
        ml: isReply ? 4 : 0,
        mb: isReply ? 1.5 : 0
      }}
    >
      <Paper 
        sx={{ 
          p: 2.5, 
          bgcolor: isReply ? 'var(--bg-secondary, #F8F9FC)' : 'var(--bg-primary, #FAFBFC)',
          border: '1px solid var(--border-subtle, #E5E7F0)',
          borderRadius: 'var(--radius-card, 16px)',
          borderLeft: isReply ? '3px solid var(--accent-primary, #7C4DFF)' : undefined
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar 
            sx={{ 
              width: 28, 
              height: 28, 
              bgcolor: 'var(--accent-primary, #7C4DFF)',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)'
            }}
          >
            {comment.wallet_address.slice(0, 1).toUpperCase()}
          </Avatar>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 600,
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            {formatWalletAddress(comment.wallet_address)}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'var(--text-muted, #A3A7B5)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              ml: 'auto'
            }}
          >
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </Typography>
        </Box>
        <Typography 
          variant="body2" 
          sx={{ 
            whiteSpace: 'pre-wrap',
            color: 'var(--text-primary, #1A1A1E)',
            lineHeight: 1.6,
            fontSize: '15px',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            mb: 1
          }}
        >
          {comment.message}
        </Typography>

        {/* Reply button (only for top-level comments) */}
        {!isReply && publicKey && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              startIcon={<ReplyIcon sx={{ fontSize: 16 }} />}
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              sx={{
                textTransform: 'none',
                color: 'var(--accent-primary, #7C4DFF)',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                p: 0.5,
                minWidth: 'auto',
                '&:hover': {
                  bgcolor: 'var(--accent-primary-soft, rgba(124, 77, 255, 0.1))'
                }
              }}
            >
              Reply
            </Button>
          </Box>
        )}

        {/* Reply input */}
        {replyingTo === comment.id && !isReply && (
          <Box sx={{ mt: 2, pl: 4, borderLeft: '2px solid var(--accent-primary, #7C4DFF)' }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={replyTexts[comment.id] || ''}
              onChange={(e) => setReplyTexts(prev => ({ 
                ...prev, 
                [comment.id]: e.target.value.slice(0, 2000) 
              }))}
              placeholder="Write a reply..."
              disabled={postingReply === comment.id}
              sx={{ 
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'var(--bg-primary, #fff)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  borderRadius: 'var(--radius-card, 16px)',
                  '&:hover fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                  }
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                }}
              >
                {(replyTexts[comment.id] || '').length}/2,000
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    setReplyingTo(null)
                    setReplyTexts(prev => ({ ...prev, [comment.id]: '' }))
                  }}
                  sx={{ 
                    textTransform: 'none',
                    color: 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={!replyTexts[comment.id]?.trim() || postingReply === comment.id}
                  sx={{ 
                    bgcolor: 'var(--accent-primary, #7C4DFF)',
                    '&:hover': { bgcolor: '#6A3FE8' },
                    '&:disabled': { bgcolor: 'var(--border-subtle, #E5E7F0)' },
                    textTransform: 'none',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    borderRadius: 'var(--radius-control, 999px)'
                  }}
                >
                  {postingReply === comment.id ? 'Posting...' : 'Post Reply'}
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )

  if (!submission) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card-lg, 24px)',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar 
            sx={{ 
              width: 44, 
              height: 44, 
              bgcolor: 'var(--accent-primary, #7C4DFF)',
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            {submission.worker_wallet.slice(0, 2).toUpperCase()}
          </Avatar>
          <Box>
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
                {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
              </Typography>
            </Box>
          </Box>
          {submission.is_selected_winner && (
            <Chip
              icon={<EmojiEventsIcon sx={{ color: '#1A1A1E !important' }} />}
              label={getWinnerLabel(submission.winner_position)}
              sx={{
                bgcolor: 'var(--accent-warning, #FFC857)',
                color: '#1A1A1E',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 700,
                borderRadius: 'var(--radius-control, 999px)'
              }}
            />
          )}
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Image Gallery */}
        {submission.image_urls && submission.image_urls.length > 0 && (
          <Box sx={{ position: 'relative', bgcolor: 'black' }}>
            <Box
              component="img"
              src={submission.image_urls[currentImageIndex]}
              alt={`Submission image ${currentImageIndex + 1}`}
              sx={{
                width: '100%',
                maxHeight: '50vh',
                objectFit: 'contain'
              }}
            />
            
            {/* Image navigation */}
            {submission.image_urls.length > 1 && (
              <>
                <IconButton
                  onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
                  disabled={currentImageIndex === 0}
                  sx={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': { bgcolor: 'white' },
                    '&:disabled': { bgcolor: 'rgba(255, 255, 255, 0.5)' }
                  }}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  onClick={() => setCurrentImageIndex(i => Math.min(submission.image_urls!.length - 1, i + 1))}
                  disabled={currentImageIndex === submission.image_urls.length - 1}
                  sx={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': { bgcolor: 'white' },
                    '&:disabled': { bgcolor: 'rgba(255, 255, 255, 0.5)' }
                  }}
                >
                  <ChevronRightIcon />
                </IconButton>

                {/* Thumbnails */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1.5, 
                  p: 2, 
                  bgcolor: 'rgba(0, 0, 0, 0.9)',
                  overflowX: 'auto',
                  justifyContent: 'center'
                }}>
                  {submission.image_urls.map((url, index) => (
                    <Box
                      key={index}
                      component="img"
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      onClick={() => setCurrentImageIndex(index)}
                      sx={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: currentImageIndex === index 
                          ? '3px solid var(--accent-primary, #7C4DFF)' 
                          : '2px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 'var(--radius-card, 16px)',
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                        '&:hover': { 
                          transform: 'scale(1.05)',
                          borderColor: 'rgba(255, 255, 255, 0.6)'
                        }
                      }}
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>
        )}

        <Box sx={{ p: 3 }}>
          {/* Submission Message */}
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 1,
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            Entry Description
          </Typography>
          <Paper
            sx={{
              p: 3,
              mb: 3,
              bgcolor: 'var(--bg-secondary, #F8F9FC)',
              border: '1px solid var(--border-subtle, #E5E7F0)',
              borderRadius: 'var(--radius-card, 16px)'
            }}
          >
            <Typography 
              variant="body1" 
              sx={{ 
                whiteSpace: 'pre-wrap',
                color: 'var(--text-primary, #1A1A1E)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                lineHeight: 1.7
              }}
            >
              {submission.message}
            </Typography>
          </Paper>

          {/* External Links */}
          {submission.external_links && submission.external_links.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: 2,
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Links
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {submission.external_links.map((link, index) => (
                  <MuiLink
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      color: 'var(--accent-primary, #7C4DFF)',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '14px',
                      fontWeight: 500,
                      p: 2,
                      bgcolor: 'var(--accent-primary-soft, #EEE7FF)',
                      borderRadius: 'var(--radius-card, 16px)',
                      transition: 'background-color 0.2s ease',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      '&:hover': { 
                        bgcolor: 'rgba(124, 77, 255, 0.15)',
                        textDecoration: 'none'
                      }
                    }}
                  >
                    <LaunchIcon sx={{ fontSize: 18, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link}
                    </span>
                  </MuiLink>
                ))}
              </Box>
            </Box>
          )}

          {/* Prize Info for Winners */}
          {submission.is_selected_winner && submission.prize_amount_tokens && (
            <Paper sx={{ 
              p: 3, 
              mb: 3,
              bgcolor: 'rgba(255, 200, 87, 0.1)',
              borderRadius: 'var(--radius-card, 16px)',
              border: '2px solid var(--accent-warning, #FFC857)'
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontWeight: 700,
                  color: 'var(--text-primary, #1A1A1E)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                🎁 Prize Won: {submission.prize_amount_tokens.toLocaleString()} {tokenSymbol}
              </Typography>
              {submission.prize_amount_usd && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'var(--text-secondary, #6F7280)',
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    mt: 0.5
                  }}
                >
                  ≈ ${submission.prize_amount_usd.toLocaleString()} USD
                </Typography>
              )}
            </Paper>
          )}

          {/* Comments Section */}
          <Box sx={{ borderTop: '1px solid var(--border-subtle, #E5E7F0)', pt: 3 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2,
                fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              Comments ({comments.length})
            </Typography>

            {/* Comments List */}
            <Box sx={{ mb: 3, maxHeight: '300px', overflowY: 'auto' }}>
              {loadingComments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} sx={{ color: 'var(--accent-primary, #7C4DFF)' }} />
                </Box>
              ) : organizedComments.length === 0 ? (
                <Paper
                  sx={{
                    p: 4,
                    bgcolor: 'var(--bg-secondary, #F8F9FC)',
                    textAlign: 'center',
                    border: '1px dashed var(--border-subtle, #E5E7F0)',
                    borderRadius: 'var(--radius-card, 16px)'
                  }}
                >
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'var(--text-secondary, #6F7280)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                    }}
                  >
                    No comments yet. Be the first to comment on this entry!
                  </Typography>
                </Paper>
              ) : (
                organizedComments.map((comment: SubmissionCommentWithReplies) => (
                  <Box key={comment.id} sx={{ mb: 2 }}>
                    {renderComment(comment, false)}
                    {comment.replies.length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        {comment.replies.map(reply => renderComment(reply, true))}
                      </Box>
                    )}
                  </Box>
                ))
              )}
            </Box>

            {/* New Comment Input */}
            {publicKey ? (
              <Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value.slice(0, 2000))}
                  placeholder="Add a comment on this entry..."
                  disabled={posting}
                  sx={{ 
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'var(--bg-primary, #fff)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      borderRadius: 'var(--radius-card, 16px)',
                      '&:hover fieldset': {
                        borderColor: 'var(--accent-primary, #7C4DFF)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-primary, #7C4DFF)',
                      }
                    }
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'var(--text-secondary, #6F7280)',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                    }}
                  >
                    {newComment.length}/2,000 characters
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || posting}
                    sx={{ 
                      bgcolor: 'var(--accent-primary, #7C4DFF)',
                      '&:hover': { bgcolor: '#6A3FE8' },
                      '&:disabled': { bgcolor: 'var(--border-subtle, #E5E7F0)' },
                      textTransform: 'none',
                      fontWeight: 600,
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      px: 3,
                      borderRadius: 'var(--radius-control, 999px)'
                    }}
                  >
                    {posting ? 'Posting...' : 'Post Comment'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Paper 
                sx={{ 
                  p: 3, 
                  bgcolor: 'var(--bg-secondary, #F8F9FC)', 
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle, #E5E7F0)',
                  borderRadius: 'var(--radius-card, 16px)'
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'var(--text-secondary, #6F7280)', 
                    fontWeight: 600,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Connect your wallet to comment
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

