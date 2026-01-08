/**
 * Social Job Dispute Card
 * 
 * Individual dispute card with resolution interface.
 * Allows admins to review details and resolve in favor of poster or worker.
 * 
 * Usage:
 * ```tsx
 * <SocialJobDisputeCard 
 *   dispute={dispute}
 *   onResolved={() => refreshList()}
 * />
 * ```
 */

'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Collapse,
  IconButton,
  Chip,
  TextField,
  Avatar,
  Divider,
  Alert
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import PersonIcon from '@mui/icons-material/Person'
import WorkIcon from '@mui/icons-material/Work'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { format } from 'date-fns'

import { truncateWallet } from '@/lib/utils'
import { LoadingButton } from '@/components/ui/LoadingStates'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

// ==================== TYPES ====================

interface SocialJobDispute {
  id: string
  job_id: string
  submission_id: string
  opened_by: string
  dispute_type: string
  reason: string
  status: 'pending_admin_review' | 'resolved_poster_favor' | 'resolved_worker_favor'
  created_at: string
  resolved_at?: string
  resolved_by?: string
  admin_notes?: string
  
  job?: {
    id: string
    title: string
    poster_wallet: string
    social_total_budget_usd?: number
    status?: string
  }
  
  submission?: {
    id: string
    worker_wallet: string
    social_tweet_link?: string
    social_payment_amount_usd?: number
    social_impressions_24h?: number
    social_approval_status?: string
    submitted_at?: string
    updated_at?: string
  }
}

interface SocialJobDisputeCardProps {
  dispute: SocialJobDispute
  onResolved: () => void
  highlight?: boolean
}

// ==================== MAIN COMPONENT ====================

export function SocialJobDisputeCard({ 
  dispute, 
  onResolved,
  highlight = false
}: SocialJobDisputeCardProps) {
  const [expanded, setExpanded] = useState(highlight)
  const [adminNotes, setAdminNotes] = useState('')
  const [resolving, setResolving] = useState(false)
  
  const isPending = dispute.status === 'pending_admin_review'
  const isResolved = !isPending
  
  // Handle resolution
  const handleResolve = async (resolution: 'poster_favor' | 'worker_favor') => {
    try {
      setResolving(true)
      
      const response = await fetch(`/api/admin/disputes/${dispute.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution,
          admin_notes: adminNotes || undefined
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve dispute')
      }
      
      showSuccessToast(`Dispute resolved in ${resolution === 'worker_favor' ? "worker's" : "poster's"} favor`)
      onResolved()
      
    } catch (error) {
      console.error('[DisputeCard] Resolution error:', error)
      showErrorToast(error instanceof Error ? error.message : 'Failed to resolve dispute')
    } finally {
      setResolving(false)
    }
  }
  
  // ==================== RENDER ====================
  
  return (
    <Card
      sx={{
        border: highlight ? '3px solid var(--accent-primary, #7C4DFF)' : '2px solid var(--border-subtle, #E5E7F0)',
        borderRadius: 'var(--radius-card-lg, 24px)',
        background: 'var(--card-background, #FFFFFF)',
        transition: 'all 0.3s ease',
        boxShadow: highlight ? '0 8px 24px rgba(124, 77, 255, 0.15)' : 'none',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          borderColor: isPending ? 'var(--accent-primary, #7C4DFF)' : undefined
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                {dispute.job?.title || 'Untitled Campaign'}
              </Typography>
              
              <Chip
                label={isPending ? 'Pending Review' : 'Resolved'}
                size="small"
                sx={{
                  height: 22,
                  background: isPending ? '#FFC857' : '#36C170',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              />
            </Box>
            
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '13px',
                color: 'var(--text-muted, #A3A7B5)'
              }}
            >
              Dispute ID: {dispute.id.slice(0, 8)}... • Opened {format(new Date(dispute.created_at), 'MMM d, yyyy')}
            </Typography>
          </Box>
          
          <IconButton
            onClick={() => setExpanded(!expanded)}
            sx={{
              color: 'var(--text-secondary, #6F7280)',
              '&:hover': {
                background: 'var(--subtle-background, #F7F8FB)'
              }
            }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        {/* Quick Info */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<PersonIcon />}
            label={`Poster: ${truncateWallet(dispute.job?.poster_wallet || '')}`}
            variant="outlined"
            size="small"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px'
            }}
          />
          <Chip
            icon={<WorkIcon />}
            label={`Worker: ${truncateWallet(dispute.submission?.worker_wallet || '')}`}
            variant="outlined"
            size="small"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px'
            }}
          />
          <Chip
            icon={<AttachMoneyIcon />}
            label={`$${dispute.submission?.social_payment_amount_usd?.toFixed(2) || '0.00'}`}
            variant="outlined"
            size="small"
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: '#36C170',
              borderColor: '#36C170'
            }}
          />
        </Box>
        
        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 3 }} />
          
          {/* Dispute Reason */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              Reason for Rejection:
            </Typography>
            <Alert
              severity="warning"
              icon={<ThumbDownIcon />}
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
                background: 'rgba(255, 200, 87, 0.1)',
                border: '1px solid #FFC857'
              }}
            >
              {dispute.reason || 'No reason provided'}
            </Alert>
          </Box>
          
          {/* Submission Details */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 2
              }}
            >
              Submission Details:
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary, #6F7280)' }}>
                  Payment Amount:
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#36C170' }}>
                  ${dispute.submission?.social_payment_amount_usd?.toFixed(2) || '0.00'}
                </Typography>
              </Box>
              
              {dispute.submission?.social_impressions_24h && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary, #6F7280)' }}>
                    Impressions (24h):
                  </Typography>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
                    {dispute.submission.social_impressions_24h.toLocaleString()}
                  </Typography>
                </Box>
              )}
              
              {dispute.submission?.social_tweet_link && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VisibilityIcon />}
                  endIcon={<OpenInNewIcon />}
                  onClick={() => window.open(dispute.submission?.social_tweet_link || '', '_blank')}
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '12px',
                    textTransform: 'none',
                    borderRadius: 'var(--radius-control, 999px)',
                    mt: 1
                  }}
                >
                  View Tweet
                </Button>
              )}
              
              {dispute.submission?.submitted_at && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '13px', color: 'var(--text-secondary, #6F7280)' }}>
                    Submitted:
                  </Typography>
                  <Typography sx={{ fontSize: '13px' }}>
                    {format(new Date(dispute.submission.submitted_at), 'MMM d, yyyy h:mm a')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
          
          {/* Resolution Section */}
          {isPending && (
            <>
              <Divider sx={{ my: 3 }} />
              
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1A1A1E)',
                    mb: 2
                  }}
                >
                  Admin Resolution:
                </Typography>
                
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add notes about your decision (optional)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '14px'
                    }
                  }}
                />
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <LoadingButton
                    variant="contained"
                    loading={resolving}
                    loadingText="Resolving..."
                    startIcon={<ThumbUpIcon />}
                    onClick={() => handleResolve('worker_favor')}
                    sx={{
                      flex: 1,
                      minWidth: '200px',
                      background: '#36C170',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: 'var(--radius-control, 999px)',
                      '&:hover': {
                        background: '#2DA85E'
                      }
                    }}
                  >
                    Resolve in Worker's Favor
                  </LoadingButton>
                  
                  <LoadingButton
                    variant="contained"
                    loading={resolving}
                    loadingText="Resolving..."
                    startIcon={<ThumbDownIcon />}
                    onClick={() => handleResolve('poster_favor')}
                    sx={{
                      flex: 1,
                      minWidth: '200px',
                      background: '#EF4444',
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: 'var(--radius-control, 999px)',
                      '&:hover': {
                        background: '#DC2626'
                      }
                    }}
                  >
                    Resolve in Poster's Favor
                  </LoadingButton>
                </Box>
              </Box>
            </>
          )}
          
          {/* Resolved Info */}
          {isResolved && (
            <>
              <Divider sx={{ my: 3 }} />
              
              <Alert
                severity="success"
                icon={<ThumbUpIcon />}
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px'
                }}
              >
                <strong>Resolved:</strong> {dispute.status === 'resolved_worker_favor' ? "Worker's favor" : "Poster's favor"}
                {dispute.resolved_at && ` on ${format(new Date(dispute.resolved_at), 'MMM d, yyyy')}`}
                {dispute.admin_notes && (
                  <Box sx={{ mt: 1, fontStyle: 'italic' }}>
                    Notes: {dispute.admin_notes}
                  </Box>
                )}
              </Alert>
            </>
          )}
        </Collapse>
      </CardContent>
    </Card>
  )
}

// ==================== EXPORTS ====================

export default SocialJobDisputeCard

