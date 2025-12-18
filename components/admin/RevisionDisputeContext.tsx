'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  Button,
  CircularProgress
} from '@mui/material'
import LoopIcon from '@mui/icons-material/Loop'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GavelIcon from '@mui/icons-material/Gavel'
import { formatDistanceToNow, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import type { RevisionDisputeContext as RevisionDisputeContextType } from '@/types/database'

interface RevisionDisputeContextProps {
  disputeId: string
  jobId: string
  revisionContext: RevisionDisputeContextType | null
  disputeType: string | null
  openedBy: 'poster' | 'worker'
  onResolutionComplete?: () => void
}

/**
 * RevisionDisputeContext Component
 * 
 * Admin interface for reviewing revision-related disputes with:
 * - Revision status overview
 * - Full revision request history
 * - Original job scope reference
 * - Resolution options with prorated payment calculator
 */
export function RevisionDisputeContext({
  disputeId,
  jobId,
  revisionContext,
  disputeType,
  openedBy,
  onResolutionComplete
}: RevisionDisputeContextProps) {
  const [resolving, setResolving] = useState(false)
  const [selectedResolution, setSelectedResolution] = useState<'worker' | 'poster' | 'split' | null>(null)
  const [splitPercentage, setSplitPercentage] = useState(50) // Worker percentage

  if (!revisionContext) {
    return (
      <Alert severity="info">
        No revision context available for this dispute.
      </Alert>
    )
  }

  const {
    revisions_offered,
    revisions_used,
    revisions_remaining,
    revision_history,
    unanswered_duration_hours,
    original_scope,
    abuse_threshold_exceeded,
    suggested_proration
  } = revisionContext

  const isUnlimited = revisions_offered === 'unlimited'
  const isRevisionRefusal = disputeType === 'revision_refusal'
  const isUnlimitedAbuse = disputeType === 'unlimited_revisions_abuse'

  const handleResolve = async () => {
    if (!selectedResolution) {
      toast.error('Please select a resolution option')
      return
    }

    setResolving(true)

    try {
      // Calculate final percentages
      let workerPct = 0
      let posterPct = 0

      if (selectedResolution === 'worker') {
        workerPct = 100
        posterPct = 0
      } else if (selectedResolution === 'poster') {
        workerPct = 0
        posterPct = 100
      } else if (selectedResolution === 'split') {
        workerPct = splitPercentage
        posterPct = 100 - splitPercentage
      }

      // Update dispute with admin resolution
      const { error } = await supabase
        .from('job_disputes')
        .update({
          status: 'resolved',
          outcome: selectedResolution === 'worker' ? 'release_to_worker' : 
                   selectedResolution === 'poster' ? 'refund_to_poster' : 'split',
          worker_percentage: workerPct,
          poster_percentage: posterPct,
          admin_decided_at: new Date().toISOString(),
          admin_resolution_notes: `Admin resolved revision dispute: ${workerPct}% to worker, ${posterPct}% to poster.`,
          resolved_at: new Date().toISOString()
        })
        .eq('id', disputeId)

      if (error) throw error

      // Update job status
      await supabase
        .from('jobs')
        .update({
          status: selectedResolution === 'worker' ? 'completed' : 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      toast.success('Dispute resolved successfully')
      onResolutionComplete?.()
    } catch (error) {
      console.error('Error resolving dispute:', error)
      toast.error('Failed to resolve dispute')
    } finally {
      setResolving(false)
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 3, border: '2px solid #E5DEFF', borderRadius: '12px' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <LoopIcon sx={{ fontSize: 24, color: '#7C4DFF' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
          Revision Dispute Context
        </Typography>
        <Chip
          label={isRevisionRefusal ? 'Revision Refusal' : isUnlimitedAbuse ? 'Abuse Claim' : disputeType}
          size="small"
          sx={{
            ml: 'auto',
            backgroundColor: isRevisionRefusal ? '#FEE2E2' : '#FEF3C7',
            color: isRevisionRefusal ? '#DC2626' : '#D97706',
            fontWeight: 600
          }}
        />
      </Box>

      {/* Revision Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        <StatCard
          label="Offered"
          value={isUnlimited ? '∞' : String(revisions_offered)}
          icon={isUnlimited ? <AllInclusiveIcon sx={{ fontSize: 18 }} /> : undefined}
          color="#7C4DFF"
        />
        <StatCard
          label="Used"
          value={String(revisions_used)}
          color={revisions_used > 5 ? '#FB923C' : '#1A1A1E'}
        />
        <StatCard
          label="Remaining"
          value={revisions_remaining === 'unlimited' ? '∞' : String(revisions_remaining)}
          color={revisions_remaining === 0 ? '#EF4444' : '#36C170'}
        />
        <StatCard
          label="Pending Hours"
          value={unanswered_duration_hours ? `${unanswered_duration_hours}h` : 'N/A'}
          color={unanswered_duration_hours && unanswered_duration_hours > 48 ? '#EF4444' : '#6F7280'}
        />
      </Box>

      {/* Alerts */}
      {abuse_threshold_exceeded && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <AlertTitle sx={{ fontWeight: 600 }}>Abuse Threshold Exceeded</AlertTitle>
          Worker claims {revisions_used} revisions exceeds reasonable limits (threshold: 10)
        </Alert>
      )}

      {isRevisionRefusal && unanswered_duration_hours && unanswered_duration_hours > 48 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle sx={{ fontWeight: 600 }}>Extended Non-Response</AlertTitle>
          Revision request has been unanswered for {unanswered_duration_hours} hours ({Math.floor(unanswered_duration_hours / 24)} days)
        </Alert>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Revision History */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1A1A1E' }}>
        Revision History ({revision_history?.length || 0} requests)
      </Typography>

      {revision_history && revision_history.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F8F5FF' }}>
                <TableCell sx={{ fontWeight: 600, width: 80 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }}>Requested</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }}>Submitted</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {revision_history.map((rev, idx) => (
                <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell>
                    <Chip label={`#${rev.number}`} size="small" sx={{ fontSize: 11 }} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rev.notes.slice(0, 100)}{rev.notes.length > 100 ? '...' : ''}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#6F7280' }}>
                    {format(new Date(rev.requestedAt), 'MMM d, h:mm a')}
                  </TableCell>
                  <TableCell>
                    {rev.submittedAt ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleIcon sx={{ fontSize: 14, color: '#36C170' }} />
                        <span style={{ fontSize: 12, color: '#6F7280' }}>
                          {format(new Date(rev.submittedAt), 'MMM d')}
                        </span>
                      </Box>
                    ) : (
                      <Chip label="Pending" size="small" color="warning" sx={{ fontSize: 10, height: 20 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {rev.isVoluntary ? (
                      <Chip label="Voluntary" size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#FFF7ED', color: '#FB923C' }} />
                    ) : (
                      <Chip label="Committed" size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#E8F4FF', color: '#2563EB' }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>No revision history available</Alert>
      )}

      {/* Original Scope */}
      {original_scope && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, color: '#1A1A1E' }}>
            Original Job Scope / KPIs
          </Typography>
          <Box sx={{ p: 2, backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7F0', mb: 3 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#1A1A1E' }}>
              {original_scope}
            </Typography>
          </Box>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Resolution Options */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1A1A1E', display: 'flex', alignItems: 'center', gap: 1 }}>
        <GavelIcon sx={{ fontSize: 20 }} />
        Admin Resolution
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <ResolutionButton
          selected={selectedResolution === 'worker'}
          onClick={() => setSelectedResolution('worker')}
          label="Release to Worker"
          sublabel="100% to worker"
          color="#36C170"
        />
        <ResolutionButton
          selected={selectedResolution === 'poster'}
          onClick={() => setSelectedResolution('poster')}
          label="Refund to Poster"
          sublabel="100% to poster"
          color="#EF4444"
        />
        <ResolutionButton
          selected={selectedResolution === 'split'}
          onClick={() => setSelectedResolution('split')}
          label="Prorated Split"
          sublabel={`Based on work done (suggested: ${suggested_proration || 50}%)`}
          color="#FB923C"
        />
      </Box>

      {/* Split Slider */}
      {selectedResolution === 'split' && (
        <Box sx={{ px: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1, color: '#6F7280' }}>
            Worker receives: <strong>{splitPercentage}%</strong> | Poster receives: <strong>{100 - splitPercentage}%</strong>
          </Typography>
          <Slider
            value={splitPercentage}
            onChange={(_, value) => setSplitPercentage(value as number)}
            min={0}
            max={100}
            step={5}
            marks={[
              { value: 0, label: '0%' },
              { value: suggested_proration || 50, label: `${suggested_proration || 50}% (suggested)` },
              { value: 100, label: '100%' }
            ]}
            sx={{
              color: '#7C4DFF',
              '& .MuiSlider-mark': { backgroundColor: '#E5E7F0' },
              '& .MuiSlider-markLabel': { fontSize: 11 }
            }}
          />
        </Box>
      )}

      {/* Resolve Button */}
      <Button
        variant="contained"
        onClick={handleResolve}
        disabled={!selectedResolution || resolving}
        fullWidth
        startIcon={resolving ? <CircularProgress size={18} color="inherit" /> : <GavelIcon />}
        sx={{
          backgroundColor: '#7C4DFF',
          color: '#fff',
          textTransform: 'none',
          fontWeight: 600,
          py: 1.5,
          '&:hover': { backgroundColor: '#6B3FEE' },
          '&:disabled': { backgroundColor: '#E5E7F0' }
        }}
      >
        {resolving ? 'Resolving...' : 'Resolve Dispute'}
      </Button>
    </Paper>
  )
}

// Helper Components
function StatCard({ label, value, icon, color }: { label: string; value: string; icon?: React.ReactNode; color: string }) {
  return (
    <Box sx={{ p: 2, backgroundColor: '#F8F5FF', borderRadius: '8px', textAlign: 'center' }}>
      <Typography variant="caption" sx={{ color: '#6F7280', textTransform: 'uppercase', fontSize: 10 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        {icon}
        <Typography variant="h5" sx={{ fontWeight: 700, color }}>
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

function ResolutionButton({ 
  selected, 
  onClick, 
  label, 
  sublabel, 
  color 
}: { 
  selected: boolean; 
  onClick: () => void; 
  label: string; 
  sublabel: string; 
  color: string 
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1,
        p: 2,
        borderRadius: '8px',
        border: `2px solid ${selected ? color : '#E5E7F0'}`,
        backgroundColor: selected ? `${color}10` : '#fff',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': { borderColor: color }
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: '#6F7280' }}>
        {sublabel}
      </Typography>
    </Box>
  )
}

export default RevisionDisputeContext






