'use client'

import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Avatar, Chip, Tooltip, Skeleton } from '@mui/material'
import { format, formatDistanceToNow } from 'date-fns'
import LoopIcon from '@mui/icons-material/Loop'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AssignmentIcon from '@mui/icons-material/Assignment'
import UploadIcon from '@mui/icons-material/Upload'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import WarningIcon from '@mui/icons-material/Warning'
import { supabase } from '@/lib/supabase'
import { truncateWalletAddress } from '@/lib/usePosterDisplayName'
import type { Job, JobApplication } from '@/types/database'

interface TimelineEvent {
  id: string
  type: 'created' | 'application' | 'assigned' | 'submitted' | 'revision_requested' | 'completed' | 'disputed'
  timestamp: string
  actorWallet?: string
  metadata?: {
    revisionNumber?: number
    notes?: string
    isVoluntary?: boolean
    applicationCount?: number
    [key: string]: any
  }
}

interface JobActivityTimelineProps {
  job: Job
  applications: JobApplication[]
  /** Maximum number of events to show (0 = all) */
  maxEvents?: number
  /** Whether to show all event types or just key milestones */
  showAllEvents?: boolean
}

/**
 * JobActivityTimeline Component
 * 
 * Displays a visual timeline of job events including:
 * - Job creation
 * - Applications received
 * - Worker assignment
 * - Work submission
 * - Revision requests (highlighted with 🔄)
 * - Completion
 * - Disputes
 */
export function JobActivityTimeline({
  job,
  applications,
  maxEvents = 0,
  showAllEvents = false
}: JobActivityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [revisionComments, setRevisionComments] = useState<any[]>([])

  useEffect(() => {
    fetchRevisionComments()
  }, [job.id])

  useEffect(() => {
    buildTimeline()
  }, [job, applications, revisionComments])

  const fetchRevisionComments = async () => {
    try {
      // Fetch comments that are revision requests
      const { data: comments, error } = await supabase
        .from('job_comments')
        .select('*')
        .eq('job_id', job.id)
        .like('message', '%**Revision Request%')
        .order('created_at', { ascending: true })

      if (!error && comments) {
        setRevisionComments(comments)
      }
    } catch (err) {
      console.error('Error fetching revision comments:', err)
    } finally {
      setLoading(false)
    }
  }

  const buildTimeline = () => {
    const timeline: TimelineEvent[] = []

    // Job created
    if (job.created_at) {
      timeline.push({
        id: `created-${job.id}`,
        type: 'created',
        timestamp: job.created_at,
        actorWallet: job.poster_wallet,
        metadata: { title: job.title }
      })
    }

    // Applications (grouped if many)
    if (showAllEvents && applications.length > 0) {
      // Show individual applications
      applications.forEach(app => {
        timeline.push({
          id: `app-${app.id}`,
          type: 'application',
          timestamp: app.created_at || job.created_at || '',
          actorWallet: app.applicant_wallet
        })
      })
    } else if (applications.length > 0) {
      // Show grouped application event
      const firstApp = applications.reduce((earliest, app) => {
        if (!earliest || (app.created_at && app.created_at < earliest)) {
          return app.created_at
        }
        return earliest
      }, '' as string)

      timeline.push({
        id: `apps-${job.id}`,
        type: 'application',
        timestamp: firstApp || job.created_at || '',
        metadata: { applicationCount: applications.length }
      })
    }

    // Worker assigned
    if (job.assigned_at && job.assigned_to) {
      timeline.push({
        id: `assigned-${job.id}`,
        type: 'assigned',
        timestamp: job.assigned_at,
        actorWallet: job.assigned_to
      })
    }

    // Revision requests from comments
    revisionComments.forEach((comment, index) => {
      const revisionNumber = extractRevisionNumber(comment.message)
      const isVoluntary = comment.message.includes('Voluntary Revision')
      
      timeline.push({
        id: `revision-${comment.id}`,
        type: 'revision_requested',
        timestamp: comment.created_at,
        actorWallet: comment.wallet_address,
        metadata: {
          revisionNumber: revisionNumber || index + 1,
          isVoluntary,
          notes: extractRevisionNotes(comment.message)
        }
      })
    })

    // Work submitted
    if (job.submitted_at) {
      timeline.push({
        id: `submitted-${job.id}`,
        type: 'submitted',
        timestamp: job.submitted_at,
        actorWallet: job.assigned_to || undefined
      })
    }

    // Job completed
    if (job.completed_at) {
      timeline.push({
        id: `completed-${job.id}`,
        type: 'completed',
        timestamp: job.completed_at
      })
    }

    // Job disputed
    if (job.status === 'disputed') {
      timeline.push({
        id: `disputed-${job.id}`,
        type: 'disputed',
        timestamp: job.updated_at || job.created_at || ''
      })
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Limit events if specified
    const limitedTimeline = maxEvents > 0 ? timeline.slice(-maxEvents) : timeline

    setEvents(limitedTimeline)
  }

  const extractRevisionNumber = (message: string): number | null => {
    const match = message.match(/Revision Request #(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  const extractRevisionNotes = (message: string): string => {
    // Extract notes after the header line
    const lines = message.split('\n')
    const notesStart = lines.findIndex(line => line.includes('**Revision Request'))
    if (notesStart !== -1 && lines.length > notesStart + 2) {
      // Skip header and empty line
      const notes = lines.slice(notesStart + 2).join('\n').trim()
      // Remove image references
      const notesWithoutImages = notes.split('📎 Reference Images:')[0].trim()
      return notesWithoutImages.length > 100 
        ? notesWithoutImages.slice(0, 100) + '...' 
        : notesWithoutImages
    }
    return ''
  }

  const getEventIcon = (type: TimelineEvent['type']) => {
    const iconStyle = { fontSize: 18 }
    switch (type) {
      case 'created':
        return <PlayArrowIcon sx={{ ...iconStyle, color: '#7C4DFF' }} />
      case 'application':
        return <PersonAddIcon sx={{ ...iconStyle, color: '#3B82F6' }} />
      case 'assigned':
        return <AssignmentIcon sx={{ ...iconStyle, color: '#36C170' }} />
      case 'submitted':
        return <UploadIcon sx={{ ...iconStyle, color: '#7C4DFF' }} />
      case 'revision_requested':
        return <LoopIcon sx={{ ...iconStyle, color: '#FB923C' }} />
      case 'completed':
        return <CheckCircleIcon sx={{ ...iconStyle, color: '#36C170' }} />
      case 'disputed':
        return <WarningIcon sx={{ ...iconStyle, color: '#EF4444' }} />
      default:
        return <PlayArrowIcon sx={{ ...iconStyle, color: '#6F7280' }} />
    }
  }

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created': return '#7C4DFF'
      case 'application': return '#3B82F6'
      case 'assigned': return '#36C170'
      case 'submitted': return '#7C4DFF'
      case 'revision_requested': return '#FB923C'
      case 'completed': return '#36C170'
      case 'disputed': return '#EF4444'
      default: return '#6F7280'
    }
  }

  const getEventTitle = (event: TimelineEvent) => {
    switch (event.type) {
      case 'created':
        return 'Job Posted'
      case 'application':
        if (event.metadata?.applicationCount) {
          return `${event.metadata.applicationCount} Application${event.metadata.applicationCount > 1 ? 's' : ''} Received`
        }
        return 'Application Received'
      case 'assigned':
        return 'Worker Assigned'
      case 'submitted':
        return 'Work Submitted'
      case 'revision_requested':
        const revNum = event.metadata?.revisionNumber
        const isVol = event.metadata?.isVoluntary
        return isVol 
          ? 'Voluntary Revision Requested' 
          : `Revision #${revNum} Requested`
      case 'completed':
        return 'Job Completed'
      case 'disputed':
        return 'Dispute Opened'
      default:
        return 'Event'
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map(i => (
          <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Skeleton variant="circular" width={32} height={32} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          </Box>
        ))}
      </Box>
    )
  }

  if (events.length === 0) {
    return null
  }

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 2,
          color: '#6F7280',
          fontWeight: 600,
          textTransform: 'uppercase',
          fontSize: 12,
          letterSpacing: '0.5px'
        }}
      >
        Activity Timeline
      </Typography>

      <Box sx={{ position: 'relative' }}>
        {/* Vertical line */}
        <Box
          sx={{
            position: 'absolute',
            left: 15,
            top: 20,
            bottom: 20,
            width: 2,
            backgroundColor: '#E5E7F0',
            zIndex: 0
          }}
        />

        {events.map((event, index) => (
          <Box
            key={event.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              mb: index === events.length - 1 ? 0 : 2,
              position: 'relative'
            }}
          >
            {/* Icon circle */}
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: `2px solid ${getEventColor(event.type)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                flexShrink: 0
              }}
            >
              {getEventIcon(event.type)}
            </Box>

            {/* Event content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: '#1A1A1E',
                    fontFamily: 'var(--font-display), Space Grotesk, sans-serif'
                  }}
                >
                  {getEventTitle(event)}
                </Typography>

                {/* Revision badge */}
                {event.type === 'revision_requested' && (
                  <Chip
                    icon={<LoopIcon sx={{ fontSize: 14 }} />}
                    label={event.metadata?.isVoluntary ? 'Voluntary' : `#${event.metadata?.revisionNumber}`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: event.metadata?.isVoluntary ? '#FFF7ED' : '#EEE7FF',
                      color: event.metadata?.isVoluntary ? '#FB923C' : '#7C4DFF',
                      '& .MuiChip-icon': {
                        color: event.metadata?.isVoluntary ? '#FB923C' : '#7C4DFF'
                      }
                    }}
                  />
                )}
              </Box>

              {/* Actor wallet */}
              {event.actorWallet && (
                <Typography
                  variant="caption"
                  sx={{
                    color: '#6F7280',
                    fontFamily: 'monospace',
                    display: 'block'
                  }}
                >
                  by {truncateWalletAddress(event.actorWallet)}
                </Typography>
              )}

              {/* Revision notes preview */}
              {event.type === 'revision_requested' && event.metadata?.notes && (
                <Typography
                  variant="body2"
                  sx={{
                    color: '#6F7280',
                    fontSize: 13,
                    mt: 0.5,
                    fontStyle: 'italic',
                    lineHeight: 1.4
                  }}
                >
                  "{event.metadata.notes}"
                </Typography>
              )}

              {/* Timestamp */}
              <Tooltip title={format(new Date(event.timestamp), 'PPpp')} arrow>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#A3A7B5',
                    display: 'block',
                    mt: 0.5,
                    cursor: 'help'
                  }}
                >
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default JobActivityTimeline






