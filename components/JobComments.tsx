'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getJobComments, postJobComment } from '@/lib/job-comments'
import { useWallet } from '@solana/wallet-adapter-react'
import { Box, TextField, Button, Typography, Avatar, Paper } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { SupporterBadgeFetcher } from './SupporterBadgeFetcher'

interface JobCommentsProps {
  jobId: string
  projectId: string
}

interface Comment {
  id: string
  job_id: string
  commenter_wallet: string
  comment_text: string
  created_at: string
  updated_at: string
}

export default function JobComments({ jobId, projectId }: JobCommentsProps) {
  const { publicKey } = useWallet()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isHolder, setIsHolder] = useState(false)
  const [posting, setPosting] = useState(false)
  const [checkingHolder, setCheckingHolder] = useState(true)

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

  // Check if user is token holder
  useEffect(() => {
    if (publicKey) {
      checkHolderStatus()
    } else {
      setIsHolder(false)
      setCheckingHolder(false)
    }
  }, [publicKey, projectId])

  async function fetchComments() {
    const data = await getJobComments(jobId)
    setComments(data as Comment[])
  }

  async function checkHolderStatus() {
    setCheckingHolder(true)
    try {
      // Get project's token mint
      const { data: project } = await supabase
        .from('projects')
        .select('token_mint')
        .eq('id', projectId)
        .single()

      if (!project) {
        setIsHolder(false)
        return
      }

      // Check if user holds tokens
      const { data: holding } = await supabase
        .from('wallet_token_holdings')
        .select('balance')
        .eq('wallet_address', publicKey!.toString())
        .eq('token_mint', project.token_mint)
        .single()

      setIsHolder(holding && holding.balance > 0)
    } catch (error) {
      console.error('Error checking holder status:', error)
      setIsHolder(false)
    } finally {
      setCheckingHolder(false)
    }
  }

  async function handleSubmit() {
    if (!newComment.trim() || !publicKey || !isHolder || posting) return

    setPosting(true)
    
    try {
      const result = await postJobComment(
        jobId,
        publicKey.toString(),
        newComment
      )

      if (result.success) {
        toast.success('Comment posted!')
        setNewComment('')
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

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

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
        {comments.map(comment => (
          <Paper 
            key={comment.id} 
            sx={{ 
              p: 2.5, 
              mb: 2, 
              bgcolor: '#FAFBFC',
              border: '1px solid #E5E7F0',
              borderRadius: '8px'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Avatar 
                sx={{ 
                  width: 28, 
                  height: 28, 
                  bgcolor: '#7C4DFF',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {comment.commenter_wallet.slice(0, 1).toUpperCase()}
              </Avatar>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: '#1A1A1E'
                }}
              >
                {formatWalletAddress(comment.commenter_wallet)}
              </Typography>
              <SupporterBadgeFetcher 
                walletAddress={comment.commenter_wallet} 
                projectId={projectId}
                size="small"
              />
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
            <Typography 
              variant="body2" 
              sx={{ 
                whiteSpace: 'pre-wrap',
                color: '#1A1A1E',
                lineHeight: 1.6,
                fontSize: '15px'
              }}
            >
              {comment.comment_text}
            </Typography>
          </Paper>
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

      {/* Comment input */}
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
        ) : (
          <Paper 
            sx={{ 
              p: 3, 
              bgcolor: '#EEE7FF', 
              textAlign: 'center',
              border: '1px solid #D4C5FF'
            }}
          >
            <Typography variant="body2" sx={{ color: '#7C4DFF', fontWeight: 600 }}>
              {checkingHolder ? 'Checking token balance...' : 'Hold project tokens to comment'}
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
    </Box>
  )
}

