'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getJobComments, postJobComment } from '@/lib/job-comments'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Box, TextField, Button, Typography, Avatar, Paper, CircularProgress, IconButton, Tooltip, Chip } from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import ReplyIcon from '@mui/icons-material/Reply'
import LoopIcon from '@mui/icons-material/Loop'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { SupporterBadgeFetcher } from './SupporterBadgeFetcher'
import { getHolderInfo } from '@/lib/token-balance'
import { useMessaging } from '@/lib/MessagingContext'
import TipModal from './TipModal'
import { truncateWalletAddress } from '@/lib/usePosterDisplayName'

interface JobCommentsProps {
  jobId: string
  projectId: string
}

interface Comment {
  id: string
  job_id: string
  wallet_address: string
  message: string
  parent_comment_id: string | null
  created_at: string
  updated_at: string
}

interface CommentWithReplies extends Comment {
  replies: Comment[]
}

export default function JobComments({ jobId, projectId }: JobCommentsProps) {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const { openMessages } = useMessaging()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [isHolder, setIsHolder] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postingReply, setPostingReply] = useState<string | null>(null)
  const [checkingHolder, setCheckingHolder] = useState(true)
  const [tokenMint, setTokenMint] = useState<string | null>(null)
  const [tipModalOpen, setTipModalOpen] = useState(false)
  const [tipRecipient, setTipRecipient] = useState<string>('')
  const [openingMessageFor, setOpeningMessageFor] = useState<string | null>(null)
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map())

  // Fetch project token mint
  useEffect(() => {
    async function fetchProjectTokenMint() {
      const { data } = await supabase
        .from('projects')
        .select('token_mint')
        .eq('id', projectId)
        .single()
      
      if (data) {
        setTokenMint(data.token_mint)
      }
    }
    fetchProjectTokenMint()
  }, [projectId])

  // Fetch comments with real-time subscription
  useEffect(() => {
    fetchComments()
    
    // Subscribe to new comments (real-time)
    const subscription = supabase
      .channel(`job-comments-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_comments',
          filter: `job_id=eq.${jobId}`
        },
        () => {
          fetchComments()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [jobId])

  // Check if user actually holds tokens
  useEffect(() => {
    async function checkTokenHoldings() {
      if (!publicKey || !tokenMint) {
        setIsHolder(false)
        setCheckingHolder(false)
        return
      }

      setCheckingHolder(true)
      try {
        const holderInfo = await getHolderInfo(
          publicKey.toString(),
          tokenMint,
          connection
        )
        
        setIsHolder(!!holderInfo)
        
        if (!holderInfo) {
          console.log('User does not hold tokens:', publicKey.toString())
        } else {
          console.log('User holds tokens:', holderInfo.percentage.toFixed(6), '%')
        }
      } catch (error) {
        console.error('Error checking token holdings:', error)
        setIsHolder(false)
      } finally {
        setCheckingHolder(false)
      }
    }

    checkTokenHoldings()
  }, [publicKey, tokenMint, connection])

  async function fetchComments() {
    const data = await getJobComments(jobId)
    setComments(data as Comment[])
    
    // Fetch display names for all commenters
    const wallets = [...new Set((data as Comment[]).map(c => c.wallet_address))]
    if (wallets.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name')
        .in('wallet_address', wallets)
      
      if (profiles) {
        const newDisplayNames = new Map<string, string>()
        profiles.forEach(p => {
          if (p.display_name) {
            newDisplayNames.set(p.wallet_address, p.display_name)
          }
        })
        setDisplayNames(newDisplayNames)
      }
    }
  }

  // Helper to get display name or truncated wallet
  const getDisplayName = (address: string) => {
    return displayNames.get(address) || truncateWalletAddress(address)
  }

  const hasDisplayName = (address: string) => {
    return displayNames.has(address)
  }

  // Helper to detect revision request comments
  const isRevisionRequest = (message: string): boolean => {
    return message.includes('**Revision Request') || message.includes('**Voluntary Revision Request')
  }

  // Helper to parse revision request metadata
  const parseRevisionRequest = (message: string): { 
    revisionNumber: number | null
    isVoluntary: boolean
    notes: string
    images: string[]
  } => {
    const isVoluntary = message.includes('Voluntary Revision Request')
    const revisionMatch = message.match(/Revision Request #(\d+)/)
    const revisionNumber = revisionMatch ? parseInt(revisionMatch[1], 10) : null
    
    // Extract notes (content after header, before images)
    const lines = message.split('\n')
    const headerIndex = lines.findIndex(l => l.includes('**Revision Request'))
    let notes = ''
    let images: string[] = []
    
    if (headerIndex !== -1) {
      // Find where images section starts
      const imagesIndex = lines.findIndex(l => l.includes('📎 Reference Images:'))
      const notesLines = imagesIndex > -1 
        ? lines.slice(headerIndex + 2, imagesIndex)
        : lines.slice(headerIndex + 2)
      notes = notesLines.join('\n').trim()
      
      // Extract image URLs
      if (imagesIndex > -1) {
        for (let i = imagesIndex + 1; i < lines.length; i++) {
          const urlMatch = lines[i].match(/https?:\/\/[^\s]+/)
          if (urlMatch) {
            images.push(urlMatch[0])
          }
        }
      }
    }
    
    return { revisionNumber, isVoluntary, notes, images }
  }

  // Organize comments into top-level and replies
  const organizeComments = (): CommentWithReplies[] => {
    const topLevelComments = comments.filter(c => !c.parent_comment_id)
    
    return topLevelComments.map(comment => ({
      ...comment,
      replies: comments.filter(c => c.parent_comment_id === comment.id)
    }))
  }

  async function handleSubmit() {
    if (!newComment.trim() || !publicKey || !tokenMint || posting) return

    setPosting(true)
    
    try {
      const result = await postJobComment(
        jobId,
        publicKey.toString(),
        newComment,
        tokenMint
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

  async function handleReplySubmit(parentId: string) {
    const replyText = replyTexts[parentId]?.trim()
    if (!replyText || !publicKey || !tokenMint || postingReply) return

    setPostingReply(parentId)
    
    try {
      const result = await postJobComment(
        jobId,
        publicKey.toString(),
        replyText,
        tokenMint,
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

  // Removed formatWalletAddress - using getDisplayName instead

  const handleOpenMessage = async (targetWallet: string) => {
    if (!publicKey) {
      toast.error('Please connect your wallet to send messages')
      return
    }

    if (publicKey.toString() === targetWallet) {
      return
    }

    setOpeningMessageFor(targetWallet)
    try {
      await openMessages(targetWallet)
    } catch (error) {
      console.error('Error opening messages:', error)
      toast.error('Failed to open messages')
    } finally {
      setOpeningMessageFor(null)
    }
  }

  const handleOpenTipModal = (targetWallet: string) => {
    if (!publicKey) {
      toast.error('Please connect your wallet to send tips')
      return
    }

    if (publicKey.toString() === targetWallet) {
      toast.error("You can't tip yourself")
      return
    }

    setTipRecipient(targetWallet)
    setTipModalOpen(true)
  }

  // Helper to render message and tip buttons
  const renderMessageTipButtons = (targetWallet: string) => {
    if (!publicKey || publicKey.toString() === targetWallet) return null

    return (
      <>
        {/* Message Button */}
        <Tooltip title="Send message" arrow>
          <IconButton
            size="small"
            onClick={() => handleOpenMessage(targetWallet)}
            disabled={openingMessageFor === targetWallet}
            sx={{
              padding: '2px',
              ml: 0.5,
              color: '#7C4DFF',
              '&:hover': { 
                bgcolor: 'rgba(124, 77, 255, 0.1)',
                boxShadow: '0 0 8px rgba(124, 77, 255, 0.4)'
              },
              transition: 'all 0.2s ease-in-out',
              '&:disabled': {
                color: '#9E9E9E'
              }
            }}
          >
            {openingMessageFor === targetWallet ? (
              <CircularProgress size={14} sx={{ color: '#7C4DFF' }} />
            ) : (
              <MessageIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Tip Button */}
        <Tooltip title="Send tip" arrow>
          <IconButton
            size="small"
            onClick={() => handleOpenTipModal(targetWallet)}
            sx={{
              padding: '2px',
              ml: 0.5,
              color: '#36C170',
              '&:hover': { 
                bgcolor: 'rgba(54, 193, 112, 0.1)',
                boxShadow: '0 0 8px rgba(54, 193, 112, 0.4)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <LocalAtmIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </>
    )
  }

  // Render a single comment (top-level or reply)
  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isRevision = isRevisionRequest(comment.message)
    const revisionData = isRevision ? parseRevisionRequest(comment.message) : null
    
    return (
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
            bgcolor: isRevision 
              ? revisionData?.isVoluntary ? '#FFF7ED' : '#F8F5FF'
              : isReply ? '#F8F9FC' : '#FAFBFC',
            border: isRevision 
              ? `2px solid ${revisionData?.isVoluntary ? '#FB923C' : '#7C4DFF'}`
              : '1px solid #E5E7F0',
            borderRadius: '12px',
            borderLeft: isReply && !isRevision ? '3px solid #7C4DFF' : undefined
          }}
        >
          {/* Revision Request Header Badge */}
          {isRevision && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                icon={<LoopIcon sx={{ fontSize: 16 }} />}
                label={revisionData?.isVoluntary 
                  ? 'Voluntary Revision Request' 
                  : `Revision Request #${revisionData?.revisionNumber}`
                }
                sx={{
                  backgroundColor: revisionData?.isVoluntary ? '#FB923C' : '#7C4DFF',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  '& .MuiChip-icon': { color: '#fff' }
                }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Avatar 
              sx={{ 
                width: 28, 
                height: 28, 
                bgcolor: isRevision 
                  ? revisionData?.isVoluntary ? '#FB923C' : '#7C4DFF'
                  : '#7C4DFF',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {isRevision ? <LoopIcon sx={{ fontSize: 16 }} /> : comment.wallet_address.slice(0, 1).toUpperCase()}
            </Avatar>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600,
                fontFamily: hasDisplayName(comment.wallet_address) ? 'inherit' : 'monospace',
                color: '#1A1A1E'
              }}
            >
              {getDisplayName(comment.wallet_address)}
            </Typography>
            <SupporterBadgeFetcher 
              walletAddress={comment.wallet_address} 
              projectId={projectId}
              size="small"
            />
            {renderMessageTipButtons(comment.wallet_address)}
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#A3A7B5',
                ml: 'auto'
              }}
            >
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </Typography>
          </Box>
          
          {/* Content - show parsed notes for revision requests */}
          <Typography 
            variant="body2" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              color: '#1A1A1E',
              lineHeight: 1.6,
              fontSize: '15px',
              mb: 1
            }}
          >
            {isRevision && revisionData ? revisionData.notes : comment.message}
          </Typography>
          
          {/* Revision Reference Images */}
          {isRevision && revisionData?.images && revisionData.images.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: '#6F7280', fontWeight: 600, mb: 1, display: 'block' }}>
                Reference Images
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {revisionData.images.map((url, idx) => (
                  <Box
                    key={idx}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '2px solid #E5E7F0',
                      '&:hover': { borderColor: '#7C4DFF' }
                    }}
                  >
                    <img
                      src={url}
                      alt={`Reference ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

        {/* Reply button (only for top-level comments, not revision requests) */}
        {!isReply && !isRevision && publicKey && isHolder && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              startIcon={<ReplyIcon sx={{ fontSize: 16 }} />}
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              sx={{
                textTransform: 'none',
                color: '#7C4DFF',
                fontSize: '13px',
                fontWeight: 600,
                p: 0.5,
                minWidth: 'auto',
                '&:hover': {
                  bgcolor: 'rgba(124, 77, 255, 0.1)'
                }
              }}
            >
              Reply
            </Button>
          </Box>
        )}

        {/* Reply input (shown when replying to this comment) */}
        {replyingTo === comment.id && !isReply && (
          <Box sx={{ mt: 2, pl: 4, borderLeft: '2px solid #7C4DFF' }}>
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
                  bgcolor: '#fff',
                  '&:hover fieldset': {
                    borderColor: '#7C4DFF',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#7C4DFF',
                  }
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#6F7280' }}>
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
                    color: '#6F7280'
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={!replyTexts[comment.id]?.trim() || postingReply === comment.id}
                  sx={{ 
                    bgcolor: '#7C4DFF',
                    '&:hover': { bgcolor: '#6A3FE8' },
                    '&:disabled': { bgcolor: '#E5E7F0' },
                    textTransform: 'none',
                    fontWeight: 600
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
  }

  const organizedComments = organizeComments()

  return (
    <Box sx={{ mt: 4 }}>
      <Typography 
        variant="h6" 
        sx={{ 
          mb: 2, 
          fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
          color: '#1A1A1E',
          fontWeight: 700
        }}
      >
        Job Discussion ({comments.length})
      </Typography>

      {/* Comments list */}
      <Box sx={{ mb: 3, maxHeight: '500px', overflowY: 'auto' }}>
        {organizedComments.map(comment => (
          <Box key={comment.id} sx={{ mb: 2 }}>
            {/* Top-level comment */}
            {renderComment(comment, false)}
            
            {/* Replies to this comment */}
            {comment.replies.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                {comment.replies.map(reply => renderComment(reply, true))}
              </Box>
            )}
          </Box>
        ))}
        {comments.length === 0 && (
          <Paper
            sx={{
              p: 4,
              bgcolor: '#F8F9FC',
              textAlign: 'center',
              border: '1px dashed #E5E7F0'
            }}
          >
            <Typography variant="body2" sx={{ color: '#6F7280' }}>
              No comments yet. Be the first to comment!
            </Typography>
          </Paper>
        )}
      </Box>

      {/* New comment input */}
      {publicKey ? (
        isHolder ? (
          <Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value.slice(0, 2000))}
              placeholder="Add a comment or ask a question..."
              disabled={posting}
              sx={{ 
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#fff',
                  '&:hover fieldset': {
                    borderColor: '#7C4DFF',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#7C4DFF',
                  }
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#6F7280' }}>
                {newComment.length}/2,000 characters
              </Typography>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!newComment.trim() || posting}
                sx={{ 
                  bgcolor: '#7C4DFF',
                  '&:hover': { bgcolor: '#6A3FE8' },
                  '&:disabled': { bgcolor: '#E5E7F0' },
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                {posting ? 'Posting...' : 'Post Comment'}
              </Button>
            </Box>
          </Box>
        ) : checkingHolder ? (
          <Paper 
            sx={{ 
              p: 3, 
              bgcolor: '#F8F9FC', 
              textAlign: 'center',
              border: '1px solid #E5E7F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2
            }}
          >
            <CircularProgress size={20} sx={{ color: '#7C4DFF' }} />
            <Typography variant="body2" sx={{ color: '#6F7280', fontWeight: 600 }}>
              Checking token holdings...
            </Typography>
          </Paper>
        ) : (
          <Paper 
            sx={{ 
              p: 3, 
              bgcolor: '#FFF4E6', 
              textAlign: 'center',
              border: '1px solid #FFE5B4'
            }}
          >
            <Typography variant="body2" sx={{ color: '#D97706', fontWeight: 600, mb: 0.5 }}>
              You must hold tokens of this project to comment
            </Typography>
            <Typography variant="caption" sx={{ color: '#6F7280', display: 'block' }}>
              Only token holders can participate in job discussions
            </Typography>
          </Paper>
        )
      ) : (
        <Paper 
          sx={{ 
            p: 3, 
            bgcolor: '#F8F9FC', 
            textAlign: 'center',
            border: '1px solid #E5E7F0'
          }}
        >
          <Typography variant="body2" sx={{ color: '#6F7280', fontWeight: 600 }}>
            Connect your wallet to join the discussion
          </Typography>
        </Paper>
      )}

      {/* Tip Modal */}
      {tokenMint && (
        <TipModal
          open={tipModalOpen}
          onClose={() => setTipModalOpen(false)}
          recipientWallet={tipRecipient}
          projectId={projectId}
          tokenMint={tokenMint}
        />
      )}
    </Box>
  )
}
