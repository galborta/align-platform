'use client'

import { Card, CardContent, Box, Typography, Chip } from '@mui/material'
import { Database } from '@/types/database'
import WorkIcon from '@mui/icons-material/Work'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

type Job = Database['public']['Tables']['jobs']['Row']

interface RegularJobCardProps {
  job: Job
  projectName?: string
  tokenSymbol?: string
  applicationCount?: number
}

export default function RegularJobCard({ 
  job, 
  projectName,
  tokenSymbol = 'tokens',
  applicationCount = 0
}: RegularJobCardProps) {
  const router = useRouter()

  // Don't render contest jobs - use ContestJobCard instead
  if (job.is_contest) {
    console.warn('RegularJobCard: Attempted to render a contest job. Use ContestJobCard instead.')
    return null
  }

  // Status colors following design system
  const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    open: { bg: '#E3F8ED', text: '#36C170', icon: '🟢' },
    assigned: { bg: '#FFF4E6', text: '#FFC857', icon: '🟡' },
    submitted: { bg: '#EEE7FF', text: '#7C4DFF', icon: '🔵' },
    completed: { bg: '#F3F4F6', text: '#6B7280', icon: '✅' },
    disputed: { bg: '#FEE2E2', text: '#EF4444', icon: '🔴' },
    cancelled: { bg: '#F3F4F6', text: '#9CA3AF', icon: '❌' }
  }

  // Category colors (matching existing job system)
  const categoryColors: Record<string, { bg: string; text: string }> = {
    design: { bg: '#EEE7FF', text: '#7C4DFF' },
    marketing: { bg: '#E3F8ED', text: '#36C170' },
    development: { bg: '#E8F4FF', text: '#2563EB' },
    content: { bg: '#FFF4E6', text: '#FB923C' },
    community: { bg: '#FCE7F3', text: '#EC4899' },
    other: { bg: '#F3F4F6', text: '#6B7280' }
  }

  const statusStyle = statusColors[job.status] || statusColors.open

  return (
    <Card 
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        borderRadius: 'var(--radius-card-lg, 24px)',
        boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
        bgcolor: 'var(--card-background, #FFFFFF)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
        }
      }}
      onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
    >
      <CardContent sx={{ p: 'var(--space-lg, 24px)' }}>
        {/* Status Indicator & Category */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: '14px' }}>{statusStyle.icon}</span>
            <Typography 
              sx={{ 
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                fontSize: '13px',
                color: statusStyle.text,
                textTransform: 'capitalize'
              }}
            >
              {job.status}
            </Typography>
          </Box>
          
          {/* Category Badge */}
          <Chip
            label={job.category}
            size="small"
            sx={{
              bgcolor: categoryColors[job.category]?.bg || categoryColors.other.bg,
              color: categoryColors[job.category]?.text || categoryColors.other.text,
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontWeight: 500,
              fontSize: '12px',
              textTransform: 'capitalize',
              borderRadius: 'var(--radius-control, 999px)',
            }}
          />
        </Box>

        {/* Title */}
        <Typography 
          sx={{ 
            mb: 1, 
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontWeight: 600,
            fontSize: 'var(--text-headline, 18px)',
            color: 'var(--text-primary, #1A1A1E)',
            lineHeight: 1.4,
            minHeight: '3.5rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {job.title}
        </Typography>

        {/* Project Name */}
        {projectName && (
          <Typography 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)', 
              mb: 2, 
              display: 'block',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: 'var(--text-caption, 12px)',
            }}
          >
            by {projectName}
          </Typography>
        )}

        {/* Payment Section */}
        <Box sx={{ mb: 3 }}>
          <Typography 
            sx={{ 
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontWeight: 700, 
              color: 'var(--accent-primary, #7C4DFF)', 
              fontSize: '20px',
              lineHeight: 1.2
            }}
          >
            {job.payment_amount_tokens.toLocaleString()} {tokenSymbol}
          </Typography>
          <Typography 
            sx={{ 
              color: 'var(--text-secondary, #6F7280)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
            }}
          >
            ${job.payment_amount_usd.toLocaleString()} USD
          </Typography>
        </Box>

        {/* Application Count (for open jobs) */}
        {applicationCount > 0 && job.status !== 'completed' && (
          <Box sx={{ mb: 2 }}>
            <Chip 
              label={`${applicationCount} ${applicationCount === 1 ? 'application' : 'applications'}`}
              size="small"
              sx={{
                bgcolor: '#E8F4FF',
                color: '#2563EB',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontWeight: 500,
                fontSize: '12px',
                borderRadius: 'var(--radius-control, 999px)',
              }}
            />
          </Box>
        )}

        {/* Assigned Worker (if applicable) */}
        {job.assigned_to && job.status !== 'completed' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonIcon sx={{ fontSize: 16, color: 'var(--text-secondary, #6F7280)' }} />
            <Typography 
              sx={{ 
                color: 'var(--text-secondary, #6F7280)',
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                fontSize: '13px',
              }}
            >
              {job.assigned_to.slice(0, 4)}...{job.assigned_to.slice(-4)}
            </Typography>
          </Box>
        )}

        {/* Completed By (for completed jobs) */}
        {job.status === 'completed' && job.assigned_to && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                sx={{ 
                  color: 'var(--text-secondary, #6F7280)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '13px',
                }}
              >
                Completed by:
              </Typography>
              <Typography 
                sx={{ 
                  color: 'var(--text-primary, #1A1A1E)',
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  fontSize: '13px',
                }}
              >
                {job.assigned_to.slice(0, 4)}...{job.assigned_to.slice(-4)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Footer: Timestamp & Escrow Indicator */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            pt: 2, 
            borderTop: '1px solid var(--border-subtle, #E5E7F0)' 
          }}
        >
          <Typography 
            sx={{ 
              color: 'var(--text-muted, #A3A7B5)',
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
            }}
          >
            {job.status === 'completed' && job.completed_at 
              ? `Completed ${formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}`
              : `Posted ${formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}`
            }
          </Typography>
          
          {/* Escrow indicator */}
          {job.escrow_locked && job.status !== 'completed' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LockIcon sx={{ fontSize: 14, color: 'var(--accent-warning, #FFC857)' }} />
              <Typography 
                sx={{ 
                  color: 'var(--accent-warning, #FFC857)',
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '11px',
                  fontWeight: 500
                }}
              >
                Escrow
              </Typography>
            </Box>
          )}

          {/* Application count for footer */}
          {job.status === 'open' && applicationCount > 0 && (
            <Typography 
              sx={{ 
                color: 'var(--accent-primary, #7C4DFF)',
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              {applicationCount} {applicationCount === 1 ? 'application' : 'applications'}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

