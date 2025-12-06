'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AppHeader } from '@/components/AppHeader'
import { JobApplicationModal } from '@/components/JobApplicationModal'
import { WorkSubmissionModal } from '@/components/WorkSubmissionModal'
import { CreateJobModal } from '@/components/CreateJobModal'
import { OpenDisputeModal } from '@/components/OpenDisputeModal'
import { SupporterBadge } from '@/components/SupporterBadge'
import { SupporterBadgeFetcher } from '@/components/SupporterBadgeFetcher'
import JobComments from '@/components/JobComments'
import TipModal from '@/components/TipModal'
import ContestJobHeader from '@/components/ContestJobHeader'
import ContestSubmissionModal from '@/components/ContestSubmissionModal'
import ContestSubmissionGallery from '@/components/ContestSubmissionGallery'
import WinnerSelectionModal from '@/components/WinnerSelectionModal'
import ContestPayoutModal from '@/components/ContestPayoutModal'
import { SocialMediaJobDetail } from '@/components/jobs'
import { RevisionCounter } from '@/components/jobs/RevisionCounter'
import { RequestRevisionModal } from '@/components/jobs/RequestRevisionModal'
import { SubmitRevisionModal } from '@/components/jobs/SubmitRevisionModal'
import { OpenRevisionDisputeModal } from '@/components/jobs/OpenRevisionDisputeModal'
import { JobActivityTimeline } from '@/components/jobs/JobActivityTimeline'
import { supabase } from '@/lib/supabase'
import { getLatestRevisionRequest, getRevisionHistory, parseRevisionOffering, formatRevisionOffering } from '@/lib/revisions'
import { usePosterDisplayName } from '@/lib/usePosterDisplayName'
import { getJobById } from '@/lib/jobs'
import { upvoteApplication, getApplicationVotes, hasUserVoted } from '@/lib/job-upvoting'
import { awardApplicationUpvoterBonuses } from '@/lib/job-karma'
import { notificationService } from '@/lib/services/notificationService'
import { Database } from '@/types/database'
import { useWallet } from '@solana/wallet-adapter-react'
import { formatDistanceToNow, addDays, format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { useMessaging } from '@/lib/MessagingContext'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MessageIcon from '@mui/icons-material/Message'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import IconButton from '@mui/material/IconButton'
import MuiButton from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import SearchIcon from '@mui/icons-material/Search'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import LockIcon from '@mui/icons-material/Lock'
import WorkIcon from '@mui/icons-material/Work'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import WarningIcon from '@mui/icons-material/Warning'
import CloseIcon from '@mui/icons-material/Close'
import GavelIcon from '@mui/icons-material/Gavel'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import InfoIcon from '@mui/icons-material/Info'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import LinearProgress from '@mui/material/LinearProgress'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import LoopIcon from '@mui/icons-material/Loop'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'

type Job = Database['public']['Tables']['jobs']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type JobApplication = Database['public']['Tables']['job_applications']['Row']
type JobSubmission = Database['public']['Tables']['job_submissions']['Row']

interface ApplicationWithStats extends JobApplication {
  applicant_karma?: number
  applicant_completed_jobs?: number
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  design: { bg: '#EEE7FF', text: '#7C4DFF' },
  marketing: { bg: '#E3F8ED', text: '#36C170' },
  development: { bg: '#E8F4FF', text: '#2563EB' },
  content: { bg: '#FFF4E6', text: '#FB923C' },
  community: { bg: '#FCE7F3', text: '#EC4899' },
  other: { bg: '#F3F4F6', text: '#6B7280' }
}

const statusColors: Record<string, string> = {
  open: '#36C170',
  assigned: '#FFC857',
  submitted: '#7C4DFF',
  completed: '#6B7280',
  disputed: '#EF4444',
  cancelled: '#9CA3AF'
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  submitted: 'Work Submitted',
  completed: 'Completed',
  disputed: 'In Dispute',
  cancelled: 'Cancelled'
}

// Helper function to calculate days until deadline
function getDaysUntilDeadline(deadline: string): number {
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const diffTime = deadlineDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Helper function to format deadline with relative time
function formatDeadline(deadline: string): string {
  const date = new Date(deadline)
  const days = getDaysUntilDeadline(deadline)
  
  if (days < 0) {
    return `${format(date, 'MMM dd, yyyy')} (OVERDUE by ${Math.abs(days)} days)`
  } else if (days === 0) {
    return `${format(date, 'MMM dd, yyyy')} (TODAY)`
  } else if (days === 1) {
    return `${format(date, 'MMM dd, yyyy')} (TOMORROW)`
  } else if (days <= 7) {
    return `${format(date, 'MMM dd, yyyy')} (in ${days} days)`
  } else {
    return format(date, 'MMM dd, yyyy')
  }
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { publicKey } = useWallet()
  const { openMessages } = useMessaging()
  const [job, setJob] = useState<Job | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [posterJobCount, setPosterJobCount] = useState<number>(0)
  const [tipModalOpen, setTipModalOpen] = useState(false)
  const [tipRecipient, setTipRecipient] = useState<string>('')
  const [openingMessageFor, setOpeningMessageFor] = useState<string | null>(null)
  const [applications, setApplications] = useState<ApplicationWithStats[]>([])
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithStats | null>(null)
  const [showAssignConfirm, setShowAssignConfirm] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [submission, setSubmission] = useState<JobSubmission | null>(null)
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showSubmitRevisionModal, setShowSubmitRevisionModal] = useState(false)
  const [showRevisionDisputeModal, setShowRevisionDisputeModal] = useState(false)
  const [latestRevisionRequest, setLatestRevisionRequest] = useState<{
    revisionNumber: number
    isVoluntary: boolean
    notes: string
    requestedAt: string
    images: string[]
  } | null>(null)
  const [revisionHistory, setRevisionHistory] = useState<Array<{
    number: number
    notes: string
    requestedAt: string
    submittedAt?: string
    isVoluntary: boolean
  }>>([])
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [workerTxSignature, setWorkerTxSignature] = useState<string | null>(null)
  const [feeTxSignature, setFeeTxSignature] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; index: number } | null>(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showSubmitWorkModal, setShowSubmitWorkModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [userKarma, setUserKarma] = useState(0)
  const [userCompletedJobs, setUserCompletedJobs] = useState(0)
  const [dispute, setDispute] = useState<any>(null)
  const [disputeVotes, setDisputeVotes] = useState<any[]>([])
  const [userVote, setUserVote] = useState<'release' | 'refund' | null>(null)
  const [selectedVote, setSelectedVote] = useState<'release' | 'refund'>('release')
  const [voting, setVoting] = useState(false)
  const [userVoteWeight, setUserVoteWeight] = useState(0)
  const [tierMultiplier, setTierMultiplier] = useState(1)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [selectedReassignApplicant, setSelectedReassignApplicant] = useState<string | null>(null)
  const [reassigning, setReassigning] = useState(false)
  const [applicationVotes, setApplicationVotes] = useState<Record<string, { totalWeight: number; voterCount: number; hasVoted: boolean }>>({})
  const [upvoting, setUpvoting] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'votes' | 'karma' | 'recent' | 'revisions'>('votes')
  const [revisionFilter, setRevisionFilter] = useState<'all' | '3+' | '5+' | 'unlimited'>('all')
  
  // Contest-specific state
  const [contestSubmissionModalOpen, setContestSubmissionModalOpen] = useState(false)
  const [hasSubmittedToContest, setHasSubmittedToContest] = useState(false)
  const [contestSubmissionCount, setContestSubmissionCount] = useState(0)
  const [checkingContestEligibility, setCheckingContestEligibility] = useState(true)
  
  // Contest winner selection state
  const [winnerSelectionOpen, setWinnerSelectionOpen] = useState(false)
  const [payoutModalOpen, setPayoutModalOpen] = useState(false)
  const [contestSubmissions, setContestSubmissions] = useState<JobSubmission[]>([])
  const [selectedWinners, setSelectedWinners] = useState<JobSubmission[]>([])
  const [winnersForPayout, setWinnersForPayout] = useState<JobSubmission[]>([]) // Separate state for payout modal

  // Display name hooks for poster and worker
  const { displayNameOrWallet: posterDisplayName, hasDisplayName: posterHasDisplayName } = usePosterDisplayName(job?.poster_wallet || '')
  const { displayNameOrWallet: workerDisplayName, hasDisplayName: workerHasDisplayName } = usePosterDisplayName(job?.assigned_to || '')

  useEffect(() => {
    if (params.jobId && params.id) {
      fetchJobData()
    }
  }, [params.jobId, params.id])

  useEffect(() => {
    if (publicKey && project) {
      fetchUserStats()
    }
  }, [publicKey, project])

  // Check contest eligibility and fetch submission count
  useEffect(() => {
    const checkContestEligibility = async () => {
      if (!job?.is_contest) {
        setCheckingContestEligibility(false)
        return
      }

      try {
        // Get submission count
        const { count: submissionCount } = await supabase
          .from('job_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)
        
        setContestSubmissionCount(submissionCount || 0)

        // Check if user has already submitted
        if (publicKey) {
          const { data: existingSubmission } = await supabase
            .from('job_submissions')
            .select('id')
            .eq('job_id', job.id)
            .eq('worker_wallet', publicKey.toString())
            .maybeSingle()

          setHasSubmittedToContest(!!existingSubmission)
        }
      } catch (err) {
        console.error('Error checking contest eligibility:', err)
      } finally {
        setCheckingContestEligibility(false)
      }
    }

    checkContestEligibility()
  }, [job?.id, job?.is_contest, publicKey])

  // Load contest submissions and winners for winner selection
  useEffect(() => {
    const loadContestSubmissionsAndWinners = async () => {
      if (!job?.is_contest) return

      try {
        // Fetch all submissions for this contest
        const { data: submissions, error } = await supabase
          .from('job_submissions')
          .select('*')
          .eq('job_id', job.id)
          .order('submitted_at', { ascending: true })

        if (error) {
          console.error('Error fetching contest submissions:', error)
          return
        }

        setContestSubmissions(submissions || [])

        // If winners have been selected, set them
        if (job.contest_winners_selected_at) {
          const winners = (submissions || []).filter(s => s.is_selected_winner)
          setSelectedWinners(winners)
        }
      } catch (err) {
        console.error('Error loading contest submissions:', err)
      }
    }

    loadContestSubmissionsAndWinners()
  }, [job?.id, job?.is_contest, job?.contest_winners_selected_at])

  const fetchJobData = async () => {
    try {
      setLoading(true)

      // Fetch job
      const jobData = await getJobById(params.jobId as string)
      if (!jobData) {
        setError('Job not found')
        setLoading(false)
        return
      }
      console.log('📊 Fetched job data:', {
        id: jobData.id,
        status: jobData.status,
        escrow_locked: jobData.escrow_locked,
        cancelled_at: jobData.cancelled_at
      })
      setJob(jobData)

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', jobData.project_id)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Get poster's job count
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('poster_wallet', jobData.poster_wallet)

      setPosterJobCount(count || 0)

      // Fetch applications for this job
      const { data: applicationsData, error: appsError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', params.jobId as string)
        .order('created_at', { ascending: true })

      if (appsError) {
        console.error('Error fetching applications:', appsError)
      } else if (applicationsData) {
        // Fetch karma and completed jobs for each applicant
        const appsWithStats = await Promise.all(
          applicationsData.map(async (app) => {
            // Get karma
            const { data: karmaData } = await supabase
              .from('wallet_karma')
              .select('total_karma_points')
              .eq('wallet_address', app.applicant_wallet)
              .eq('project_id', jobData.project_id)
              .maybeSingle()

            // Get completed jobs count
            const { count: completedCount } = await supabase
              .from('jobs')
              .select('*', { count: 'exact', head: true })
              .eq('assigned_to', app.applicant_wallet)
              .eq('status', 'completed')

            return {
              ...app,
              applicant_karma: karmaData?.total_karma_points || 0,
              applicant_completed_jobs: completedCount || 0
            }
          })
        )

        // Fetch votes for each application
        const votesData: Record<string, any> = {}
        for (const app of appsWithStats) {
          const votes = await getApplicationVotes(app.id)
          const hasVoted = publicKey ? await hasUserVoted(app.id, publicKey.toString()) : false
          votesData[app.id] = { ...votes, hasVoted }
        }
        setApplicationVotes(votesData)

        setApplications(appsWithStats)
      }

      // Fetch latest submission if job is assigned (for revisions), submitted, completed, or disputed
      if (jobData.status === 'assigned' || jobData.status === 'submitted' || jobData.status === 'completed' || jobData.status === 'disputed') {
        // Build query - filter by assigned worker if job has one
        let submissionQuery = supabase
          .from('job_submissions')
          .select('*')
          .eq('job_id', params.jobId as string)
        
        // Filter by assigned worker to get their specific submissions
        if (jobData.assigned_to) {
          submissionQuery = submissionQuery.eq('worker_wallet', jobData.assigned_to)
        }
        
        const { data: submissions, error: submissionError } = await submissionQuery
          .order('submitted_at', { ascending: false })

        if (submissionError) {
          console.error('Error fetching submission:', submissionError)
        } else {
          // Get the most recent submission (first in descending order)
          const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null
          console.log('[fetchJobData] Setting submission to:', latestSubmission ? { id: latestSubmission.id, submitted_at: latestSubmission.submitted_at } : null)
          setSubmission(latestSubmission)
        }
      }

      // Fetch latest revision request if job is assigned (worker needs to respond)
      if (jobData.status === 'assigned' && jobData.assigned_to) {
        const revisionRequest = await getLatestRevisionRequest(params.jobId as string)
        setLatestRevisionRequest(revisionRequest)
      } else {
        setLatestRevisionRequest(null)
      }

      // Fetch revision history for disputes
      if (jobData.assigned_to) {
        const history = await getRevisionHistory(params.jobId as string)
        setRevisionHistory(history)
      }

      // Fetch dispute if job is disputed
      if (jobData.status === 'disputed') {
        await fetchDisputeData(params.jobId as string, jobData.project_id)
      }

      // Fetch transaction signatures if job is completed
      if (jobData.status === 'completed') {
        const { data: transactions, error: txError } = await supabase
          .from('job_escrow_transactions')
          .select('transaction_type, tx_signature')
          .eq('job_id', params.jobId as string)
          .in('transaction_type', ['release_to_worker', 'fee_collection'])

        if (!txError && transactions) {
          const workerTx = transactions.find(tx => tx.transaction_type === 'release_to_worker')
          const feeTx = transactions.find(tx => tx.transaction_type === 'fee_collection')
          setWorkerTxSignature(workerTx?.tx_signature || null)
          setFeeTxSignature(feeTx?.tx_signature || null)
        }
      }

    } catch (err) {
      console.error('Error fetching job data:', err)
      setError('Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  const handleUpvote = async (applicationId: string) => {
    if (!publicKey) {
      toast.error('Please connect your wallet to vote')
      return
    }

    if (!project) return

    const votes = applicationVotes[applicationId]
    if (votes?.hasVoted) {
      toast.error('You have already upvoted this application')
      return
    }

    setUpvoting(applicationId)
    
    try {
      const result = await upvoteApplication(
        applicationId, 
        publicKey.toString(), 
        project.id
      )
      
      if (result.success) {
        toast.success('Vote recorded! Karma earned 👍', {
          duration: 4000,
          icon: '⬆️'
        })
        // Refresh data to show updated votes
        await fetchJobData()
      } else {
        toast.error(result.error || 'Failed to vote')
      }
    } catch (error) {
      console.error('Error upvoting:', error)
      toast.error('Failed to submit vote')
    } finally {
      setUpvoting(null)
    }
  }

  const fetchDisputeData = async (jobId: string, projectId: string) => {
    try {
      // Fetch dispute
      const { data: disputeData, error: disputeError } = await supabase
        .from('job_disputes')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'active')
        .maybeSingle()

      if (disputeError) throw disputeError
      setDispute(disputeData)

      if (!disputeData) return

      // Fetch all votes for this dispute
      const { data: votesData, error: votesError } = await supabase
        .from('job_dispute_votes')
        .select('*')
        .eq('dispute_id', disputeData.id)

      if (votesError) throw votesError
      setDisputeVotes(votesData || [])

      // Check if user has voted
      if (publicKey) {
        const userVoteData = votesData?.find(v => v.voter_wallet === publicKey.toString())
        if (userVoteData) {
          setUserVote(userVoteData.vote)
        }

        // Calculate user's voting weight (based on token percentage)
        const { data: balanceData } = await supabase
          .from('wallet_token_balances')
          .select('balance, token_percentage')
          .eq('wallet_address', publicKey.toString())
          .eq('project_id', projectId)
          .maybeSingle()

        if (balanceData) {
          setUserVoteWeight(balanceData.token_percentage || 0)
          
          // Calculate tier multiplier based on percentage
          const pct = balanceData.token_percentage || 0
          let multiplier = 1
          if (pct >= 3) multiplier = 7 // Mega
          else if (pct >= 1) multiplier = 5.5 // Whale
          else if (pct >= 0.1) multiplier = 3 // Holder
          
          setTierMultiplier(multiplier)
        }
      }
    } catch (err) {
      console.error('Error fetching dispute data:', err)
    }
  }

  const handleVote = async () => {
    if (!publicKey || !dispute) {
      toast.error('Please connect your wallet')
      return
    }

    if (userVote) {
      toast.error('You have already voted on this dispute')
      return
    }

    // Prevent parties involved in dispute from voting
    const voterWallet = publicKey.toString()
    if (job && (voterWallet === job.poster_wallet || voterWallet === job.assigned_to)) {
      toast.error('You cannot vote on a dispute you are involved in')
      return
    }

    setVoting(true)

    try {
      // Insert vote
      const { error: voteError } = await supabase
        .from('job_dispute_votes')
        .insert({
          dispute_id: dispute.id,
          voter_wallet: publicKey.toString(),
          vote: selectedVote,
          vote_weight: userVoteWeight
        })

      if (voteError) throw voteError

      // Award immediate karma
      const immediateKarma = 5 * tierMultiplier

      // TODO: Award karma to wallet (Sprint 2.3)
      // await awardKarma(publicKey.toString(), job.project_id, immediateKarma)

      // ==================== NOTIFY DISPUTE CREATOR ====================
      
      // Notify dispute creator of vote (non-blocking, batchable)
      try {
        if (job) {
          // Determine dispute creator wallet
          const creatorWallet = dispute.opened_by === 'poster' 
            ? job.poster_wallet 
            : job.assigned_to

          if (creatorWallet) {
            await notificationService.createNotification({
              userWallet: creatorWallet,
              type: 'job_dispute_vote',
              actorWallet: publicKey.toString(),
              referenceId: dispute.id,
              referenceType: 'dispute',
              metadata: {
                job_title: job.title
              }
            })
          }
        }
      } catch (notificationError) {
        console.error('[handleVote] Failed to create vote notification:', notificationError)
        // Don't throw - notification failure is non-critical
      }

      // Update local state
      setUserVote(selectedVote)
      await fetchDisputeData(params.jobId as string, job!.project_id)

      // Calculate bonus karma
      const bonusKarma = job!.payment_amount_usd * 5 * tierMultiplier

      toast.success(
        `Vote recorded! +${immediateKarma.toFixed(1)} karma earned. Bonus if correct: +${bonusKarma.toFixed(0)}`,
        {
          duration: 5000,
          icon: '⚖️'
        }
      )
    } catch (err) {
      console.error('Error voting:', err)
      toast.error('Failed to submit vote')
    } finally {
      setVoting(false)
    }
  }

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    toast.success('Address copied!')
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const handleOpenMessage = async (targetWallet: string) => {
    if (!publicKey) {
      toast.error('Please connect your wallet to send messages')
      return
    }

    if (publicKey.toString() === targetWallet) {
      return // Can't message yourself
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

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
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

  const fetchUserStats = async () => {
    if (!publicKey || !project) return

    try {
      const { data: karmaData } = await supabase
        .from('wallet_karma')
        .select('total_karma_points, jobs_completed_as_worker_count')
        .eq('wallet_address', publicKey.toString())
        .eq('project_id', project.id)
        .maybeSingle()

      if (karmaData) {
        setUserKarma(karmaData.total_karma_points || 0)
        setUserCompletedJobs(karmaData.jobs_completed_as_worker_count || 0)
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
    }
  }

  const handleApply = () => {
    if (!publicKey) {
      toast.error('Please connect your wallet to apply')
      return
    }
    setShowApplyModal(true)
  }

  const handleSubmitWork = () => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }
    setShowSubmitWorkModal(true)
  }

  const handleCancelJob = async () => {
    if (!job || !publicKey) return

    setCancelling(true)
    try {
      // If escrow is locked, refund tokens first
      let refundSuccess = false
      let refundAmount = 0
      if (job.escrow_locked && job.escrow_amount_tokens && job.escrow_token_mint) {
        toast.loading('Refunding tokens from escrow...', { id: 'refund' })
        
        try {
          const response = await fetch(`/api/jobs/${job.id}/refund-escrow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              poster_wallet: publicKey.toString()
            })
          })

          const data = await response.json()
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Refund failed')
          }

          refundAmount = data.amountRefunded
          toast.success(`Refunded ${refundAmount.toFixed(2)} tokens`, { id: 'refund' })
          refundSuccess = true
          console.log('✅ Refund successful, proceeding to cancel job status...')
        } catch (refundError) {
          console.error('Refund error:', refundError)
          toast.error(
            refundError instanceof Error 
              ? refundError.message 
              : 'Failed to refund escrow. Please contact support.', 
            { id: 'refund' }
          )
          setCancelling(false)
          setShowCancelConfirm(false)
          return // Don't proceed with cancellation if refund fails
        }
      }

      // Cancel the job via API (uses service role to bypass RLS)
      console.log('📝 Calling cancel API...')
      try {
        const cancelResponse = await fetch(`/api/jobs/${job.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poster_wallet: publicKey.toString()
          })
        })

        const cancelData = await cancelResponse.json()
        
        if (!cancelResponse.ok || !cancelData.success) {
          throw new Error(cancelData.error || 'Failed to cancel job')
        }

        console.log('✅ Job cancelled successfully via API')
      } catch (cancelError) {
        console.error('❌ Cancel API error:', cancelError)
        throw cancelError
      }

      const refundText = refundSuccess 
        ? ` ${refundAmount.toFixed(2)} tokens refunded.` 
        : ''
      toast.success(`Job cancelled. -50 karma penalty applied.${refundText}`, {
        duration: 5000,
        icon: '🚫'
      })

      setShowCancelConfirm(false)

      // Refresh job data
      console.log('🔄 Refreshing job data...')
      await fetchJobData()
      console.log('✅ Job data refreshed')
      
      // Force Next.js to refresh the page with new data
      router.refresh()
    } catch (err) {
      console.error('Error cancelling job:', err)
      toast.error(
        err instanceof Error 
          ? err.message 
          : 'Failed to cancel job'
      )
    } finally {
      setCancelling(false)
    }
  }

  const handleEdit = () => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }
    setShowEditModal(true)
  }

  const handleCancel = () => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }
    setShowCancelConfirm(true)
  }

  const handlePickApplicant = (application: ApplicationWithStats) => {
    setSelectedApplication(application)
    setShowAssignConfirm(true)
  }

  const handleConfirmAssignment = async () => {
    if (!selectedApplication || !job || !publicKey) return

    setAssigning(true)
    try {
      console.log('🎯 Assigning job to:', selectedApplication.applicant_wallet)
      
      // Call backend API to assign the job (uses service role to bypass RLS)
      const response = await fetch(`/api/jobs/${job.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poster_wallet: publicKey.toString(),
          assigned_to: selectedApplication.applicant_wallet,
          hard_deadline: selectedApplication.committed_completion_date
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign job via API')
      }
      
      console.log('✅ Job assignment successful via API')

      // Notify the assigned worker (non-blocking)
      try {
        await notificationService.createNotification({
          userWallet: selectedApplication.applicant_wallet,
          type: 'job_assigned',
          actorWallet: job.poster_wallet,
          referenceId: job.id,
          referenceType: 'job',
          metadata: {
            job_title: job.title,
            job_type: job.category
          }
        })
      } catch (notificationError) {
        console.error('[handleConfirmAssignment] Failed to create notification:', notificationError)
        // Continue - notification failure is non-critical
      }

      toast.success(`Job assigned to ${formatWalletAddress(selectedApplication.applicant_wallet)}! 🎉`)
      setShowAssignConfirm(false)
      setSelectedApplication(null)
      
      // Refresh job data
      console.log('🔄 Refreshing job data after assignment...')
      await fetchJobData()
      console.log('📊 Job data after refresh - should be assigned now')
      
      // Force router refresh to ensure UI updates
      router.refresh()
    } catch (err) {
      console.error('Error assigning job:', err)
      toast.error(
        err instanceof Error 
          ? err.message 
          : 'Failed to assign job'
      )
    } finally {
      setAssigning(false)
    }
  }

  const getExpectedCompletionDate = (estimatedCompletion: string): Date => {
    // Parse estimated completion string (e.g., "3 days", "1 week", "2 weeks")
    const match = estimatedCompletion.match(/(\d+)\s*(day|week|month)s?/)
    if (!match) return addDays(new Date(), 7) // default 7 days

    const amount = parseInt(match[1])
    const unit = match[2]

    if (unit === 'day') return addDays(new Date(), amount)
    if (unit === 'week') return addDays(new Date(), amount * 7)
    if (unit === 'month') return addDays(new Date(), amount * 30)
    
    return addDays(new Date(), 7)
  }

  const getAutoReleaseDate = (submittedAt: string): Date => {
    return addDays(new Date(submittedAt), 10)
  }

  const getTimeUntilAutoRelease = (submittedAt: string): string => {
    const releaseDate = getAutoReleaseDate(submittedAt)
    const now = new Date()
    const diff = releaseDate.getTime() - now.getTime()

    if (diff <= 0) return 'Auto-releasing now...'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''}`
    }
  }

  const isAutoReleaseUrgent = (submittedAt: string): boolean => {
    const releaseDate = getAutoReleaseDate(submittedAt)
    const now = new Date()
    const diff = releaseDate.getTime() - now.getTime()
    const threeDays = 3 * 24 * 60 * 60 * 1000
    return diff < threeDays && diff > 0
  }

  const handleReleasePayment = async () => {
    if (!job || !publicKey) return

    setReleasing(true)
    setReleaseError(null)

    try {
      console.log('[Release Payment] Calling API for job:', job.id)
      
      // Call the payment release API endpoint
      const response = await fetch(`/api/jobs/${job.id}/release-payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          poster_wallet: publicKey.toString()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to release payment')
      }

      console.log('[Release Payment] Success:', result)

      // Award upvoter bonuses
      try {
        await awardApplicationUpvoterBonuses(job.id, job.payment_amount_usd)
      } catch (karmaError) {
        console.error('[Release Payment] Upvoter bonus failed:', karmaError)
        // Non-critical - continue
      }

      // Success notification with transaction details
      const tokenSymbol = 'SOL' // TODO: Get from job metadata
      toast.success(
        `🎉 Payment released! Worker received ${result.workerReceived.toFixed(2)} ${tokenSymbol}`,
        {
          duration: 6000,
          style: {
            background: '#36C170',
            color: '#fff',
          }
        }
      )

      console.log('[Release Payment] Worker TX:', result.workerTxSignature)
      console.log('[Release Payment] Fee TX:', result.feeTxSignature)

      // Close dialog and refresh
      setShowReleaseConfirm(false)
      
      // Refresh job data to show updated status
      await fetchJobData()
    } catch (err) {
      console.error('[Release Payment] Error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to release payment'
      setReleaseError(errorMessage)
      toast.error(errorMessage, {
        duration: 6000
      })
    } finally {
      setReleasing(false)
    }
  }

  const handleOpenDispute = () => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }
    setShowDisputeModal(true)
  }

  const handleReassign = async () => {
    if (!selectedReassignApplicant || !job || !publicKey) {
      toast.error('Please select an applicant')
      return
    }

    if (!job.assigned_to) {
      toast.error('No worker currently assigned to this job')
      return
    }

    setReassigning(true)

    try {
      // Get the new worker's application to update committed completion date
      const selectedApplication = applications.find(
        app => app.applicant_wallet === selectedReassignApplicant
      )

      // Call the reassign API endpoint
      const response = await fetch(`/api/jobs/${job.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poster_wallet: publicKey.toString(),
          new_worker_wallet: selectedReassignApplicant,
          committed_completion_date: selectedApplication?.committed_completion_date || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reassign job')
      }

      toast.success('Job reassigned. Previous worker penalized -50 karma.', {
        duration: 4000,
        icon: '🔄'
      })

      setShowReassignDialog(false)
      setSelectedReassignApplicant(null)

      // Refresh job data
      await fetchJobData()
    } catch (err: any) {
      console.error('Error reassigning job:', err)
      toast.error(err.message || 'Failed to reassign job')
    } finally {
      setReassigning(false)
    }
  }

  const truncateUrl = (url: string, maxLength: number = 40): string => {
    if (url.length <= maxLength) return url
    return url.slice(0, maxLength) + '...'
  }

  // Helper to get revision value for sorting (unlimited = 999, null = -1)
  const getRevisionSortValue = (revisions: string | null): number => {
    if (!revisions) return -1
    if (revisions === 'unlimited') return 999
    const parsed = parseInt(revisions, 10)
    return isNaN(parsed) ? -1 : parsed
  }

  // Filter and sort applications
  const getSortedApplications = () => {
    // Combine applications with their vote data
    let appsWithVotes = applications.map(app => ({
      ...app,
      votes: applicationVotes[app.id] || { totalWeight: 0, voterCount: 0, hasVoted: false }
    }))

    // Apply revision filter
    if (revisionFilter !== 'all') {
      appsWithVotes = appsWithVotes.filter(app => {
        const revValue = getRevisionSortValue(app.revisions_offered)
        switch (revisionFilter) {
          case '3+':
            return revValue >= 3 || revValue === 999 // 3+ or unlimited
          case '5+':
            return revValue >= 5 || revValue === 999 // 5+ or unlimited
          case 'unlimited':
            return revValue === 999 // unlimited only
          default:
            return true
        }
      })
    }

    switch (sortBy) {
      case 'votes':
        // Sort by total vote weight DESC, then by karma DESC (tie-breaker)
        return appsWithVotes.sort((a, b) => {
          const voteDiff = b.votes.totalWeight - a.votes.totalWeight
          if (voteDiff !== 0) return voteDiff
          // Tie-breaker: use karma
          return (b.applicant_karma || 0) - (a.applicant_karma || 0)
        })
      
      case 'karma':
        // Sort by applicant karma DESC
        return appsWithVotes.sort((a, b) => 
          (b.applicant_karma || 0) - (a.applicant_karma || 0)
        )
      
      case 'recent':
        // Sort by application created_at DESC (newest first)
        return appsWithVotes.sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
      
      case 'revisions':
        // Sort by revisions offered DESC (unlimited first, then highest numbers)
        return appsWithVotes.sort((a, b) => {
          const revDiff = getRevisionSortValue(b.revisions_offered) - getRevisionSortValue(a.revisions_offered)
          if (revDiff !== 0) return revDiff
          // Tie-breaker: use karma
          return (b.applicant_karma || 0) - (a.applicant_karma || 0)
        })
      
      default:
        return appsWithVotes
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-20">
            <CircularProgress sx={{ color: '#7C4DFF' }} />
          </div>
        </main>
      </div>
    )
  }

  if (error || !job || !project) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent>
              <p className="text-red-600">{error || 'Job not found'}</p>
              <Button
                variant="outline"
                onClick={() => router.push(`/project/${params.id}/jobs`)}
                className="mt-4"
              >
                ← Back to Jobs
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const isPoster = publicKey && publicKey.toString() === job.poster_wallet
  const isAssignedWorker = publicKey && job.assigned_to && publicKey.toString() === job.assigned_to
  
  // Check if user has already applied (and application is not invalidated)
  const hasAlreadyApplied = publicKey && applications.some(
    app => app.applicant_wallet === publicKey.toString() && !app.is_invalidated
  )
  
  // Allow applications to open OR assigned jobs (as backup applicants)
  // BUT not if user has already applied
  const canApply = (job.status === 'open' || job.status === 'assigned') && publicKey && !isPoster && !hasAlreadyApplied

  // Check if contest can select winners
  const canSelectWinners = (): boolean => {
    if (!isPoster) return false
    if (!job?.is_contest) return false
    if (job.contest_winners_selected_at) return false // Already selected
    if (contestSubmissions.length === 0) return false
    
    // Require submission deadline to have passed
    if (job.contest_submission_deadline) {
      const deadline = new Date(job.contest_submission_deadline)
      if (new Date() < deadline) {
        return false // Still accepting submissions
      }
    }
    
    return true
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => router.push(`/project/${params.id}/jobs`)}
          className="mb-6"
        >
          <ArrowBackIcon sx={{ fontSize: 18, mr: 1 }} />
          Jobs
        </Button>

        {/* Contest Header (if contest job) */}
        {job.is_contest && (
          <ContestJobHeader 
            job={job} 
            submissionCount={contestSubmissionCount}
            tokenSymbol={project.token_symbol}
          />
        )}

        {/* Poster Contest Actions (Winner Selection & Payout) */}
        {job.is_contest && isPoster && (
          <Box sx={{ mb: 3 }}>
            {!job.contest_winners_selected_at ? (
              canSelectWinners() ? (
                <Button
                  onClick={() => setWinnerSelectionOpen(true)}
                  className="w-full py-3"
                  style={{
                    background: 'var(--accent-gold, #FFD700)',
                    color: 'var(--text-primary, #1A1A1E)',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: '999px',
                    boxShadow: '0 8px 20px 0 rgba(15, 23, 42, 0.08)'
                  }}
                >
                  <EmojiEventsIcon sx={{ mr: 1 }} />
                  Select Contest Winners
                </Button>
              ) : (
                <Alert 
                  severity="info"
                  sx={{
                    borderRadius: '24px',
                    '& .MuiAlert-message': {
                      fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                    }
                  }}
                >
                  {contestSubmissions.length === 0 
                    ? 'Waiting for submissions before selecting winners'
                    : job.contest_submission_deadline && new Date() < new Date(job.contest_submission_deadline)
                    ? 'Winner selection will be available after the submission deadline'
                    : 'Not enough submissions to select winners'
                  }
                </Alert>
              )
            ) : job.status !== 'completed' ? (
              <Button
                onClick={() => {
                  // Set winners for payout from the already selected winners
                  setWinnersForPayout(selectedWinners)
                  setPayoutModalOpen(true)
                }}
                className="w-full py-3"
                style={{
                  background: 'var(--accent-success, #36C170)',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '999px',
                  boxShadow: '0 8px 20px 0 rgba(15, 23, 42, 0.08)'
                }}
              >
                <CheckCircleIcon sx={{ mr: 1 }} />
                💰 Distribute Prizes ({selectedWinners.length} winners)
              </Button>
            ) : (
              <Alert 
                severity="success" 
                icon={<CheckCircleIcon />}
                sx={{
                  borderRadius: '24px',
                  bgcolor: 'rgba(54, 193, 112, 0.08)',
                  '& .MuiAlert-message': {
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  },
                  '& .MuiAlert-icon': {
                    color: 'var(--accent-success, #36C170)'
                  }
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600,
                    fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                  }}
                >
                  Contest Complete! Prizes have been distributed.
                </Typography>
                {job.escrow_tx_signature && (
                  <Typography 
                    variant="caption"
                    sx={{ 
                      fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                      display: 'block',
                      mt: 0.5
                    }}
                  >
                    Transaction: {job.escrow_tx_signature.slice(0, 20)}...
                  </Typography>
                )}
              </Alert>
            )}
          </Box>
        )}

        {/* Contest Submit Button */}
        {job.is_contest && (
          <Box sx={{ mb: 3 }}>
            {checkingContestEligibility ? (
              <Button
                variant="primary"
                disabled
                className="w-full py-3"
              >
                <CircularProgress size={24} sx={{ color: 'white' }} />
              </Button>
            ) : (() => {
              // Check eligibility
              const canSubmitToContest = publicKey && 
                !hasSubmittedToContest && 
                job.poster_wallet !== publicKey.toString() &&
                job.contest_submission_deadline &&
                new Date() < new Date(job.contest_submission_deadline) &&
                job.status === 'open'
              
              if (canSubmitToContest) {
                return (
                  <Button
                    variant="primary"
                    onClick={() => setContestSubmissionModalOpen(true)}
                    className="w-full py-3"
                    style={{
                      background: 'var(--accent-primary, #7C4DFF)',
                      fontSize: '1.1rem',
                      fontWeight: 600
                    }}
                  >
                    🏆 Submit Your Entry
                  </Button>
                )
              } else {
                // Show reason why can't submit
                let reason = ''
                if (!publicKey) reason = 'Connect wallet to submit'
                else if (hasSubmittedToContest) reason = 'You have already submitted to this contest'
                else if (job.poster_wallet === publicKey.toString()) reason = 'You cannot submit to your own contest'
                else if (!job.contest_submission_deadline || new Date() > new Date(job.contest_submission_deadline)) reason = 'Submission deadline has passed'
                else if (job.status !== 'open') reason = 'This contest is no longer accepting submissions'

                return (
                  <Alert 
                    severity={hasSubmittedToContest ? 'success' : 'warning'}
                    sx={{
                      borderRadius: '16px',
                      '& .MuiAlert-message': {
                        fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                      }
                    }}
                  >
                    {reason}
                    {hasSubmittedToContest && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          mt: 1,
                          fontFamily: 'var(--font-body, Satoshi, sans-serif)'
                        }}
                      >
                        You can view your submission in the gallery below
                      </Typography>
                    )}
                  </Alert>
                )
              }
            })()}
          </Box>
        )}

        {/* Social Media Job Detail (if social media job) */}
        {job.is_social_media_job && (
          <SocialMediaJobDetail 
            job={job}
            projectName={project.name}
            tokenSymbol={project.token_symbol || 'tokens'}
            onSubmissionSuccess={() => fetchJobData()}
          />
        )}

        {/* Completion Success UI */}
        {job.status === 'completed' && job.completed_at && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: '#0a3d0a', border: '1px solid #4caf50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mr: 2 }} />
              <Box>
                <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 700 }}>
                  ✅ Job Completed Successfully
                </Typography>
                <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                  Completed on {format(new Date(job.completed_at), 'MMM dd, yyyy')}
                </Typography>
              </Box>
            </Box>
            
            <Divider sx={{ my: 2, borderColor: '#4caf50' }} />
            
            {/* Payment Breakdown */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                Worker Received:
              </Typography>
              <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                {(job.escrow_amount_tokens * 0.95).toFixed(2)} {project?.token_symbol || 'SOL'}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                Platform Fee (5%):
              </Typography>
              <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                {(job.escrow_amount_tokens * 0.05).toFixed(2)} {project?.token_symbol || 'SOL'}
              </Typography>
            </Box>
            
            {/* Transaction Signatures */}
            {workerTxSignature && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#a5d6a7' }}>
                  Worker payment:{' '}
                  <Link 
                    href={`https://solscan.io/tx/${workerTxSignature}`} 
                    target="_blank"
                    sx={{ 
                      color: '#66bb6a',
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    {workerTxSignature.substring(0, 8)}...{workerTxSignature.substring(workerTxSignature.length - 6)}
                    <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5, verticalAlign: 'middle' }} />
                  </Link>
                </Typography>
              </Box>
            )}
            
            {feeTxSignature && (
              <Box>
                <Typography variant="caption" sx={{ color: '#a5d6a7' }}>
                  Platform fee:{' '}
                  <Link 
                    href={`https://solscan.io/tx/${feeTxSignature}`} 
                    target="_blank"
                    sx={{ 
                      color: '#66bb6a',
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    {feeTxSignature.substring(0, 8)}...{feeTxSignature.substring(feeTxSignature.length - 6)}
                    <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5, verticalAlign: 'middle' }} />
                  </Link>
                </Typography>
              </Box>
            )}

            {/* Karma Earned Section */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #4caf50' }}>
              <Typography variant="subtitle2" sx={{ color: '#4caf50', mb: 1.5, fontWeight: 600 }}>
                🏆 Karma Distributed
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                  Worker ({job.assigned_to ? workerDisplayName : 'N/A'}):
                </Typography>
                <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                  +{(job.payment_amount_usd * 50).toLocaleString()} karma
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                  Poster ({posterDisplayName}):
                </Typography>
                <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                  +{(job.payment_amount_usd * 50).toLocaleString()} karma
                </Typography>
              </Box>
              
              <Typography variant="caption" sx={{ color: '#66bb6a', display: 'block', mt: 1 }}>
                💎 Bonus karma distributed to application upvoters
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Dispute Banner and Voting Section (for disputed jobs) */}
        {job.status === 'disputed' && dispute && (
          <>
            {/* Dispute Banner */}
            <Card className="mb-6" style={{ borderColor: '#EF4444', borderWidth: '2px' }}>
              <CardContent className="p-6" style={{ backgroundColor: '#FEF2F2' }}>
                <div className="flex items-start gap-4">
                  <GavelIcon sx={{ fontSize: 48, color: '#EF4444' }} />
                  <div className="flex-1">
                    <h2 
                      className="text-2xl font-bold mb-2"
                      style={{ color: '#1A1A1E' }}
                    >
                      ⚖️ This job is under community dispute
                    </h2>
                    
                    <div className="flex items-center gap-4 mb-2">
                      <Chip
                        label="Active Voting"
                        sx={{
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          fontWeight: 600
                        }}
                      />
                      {dispute.ends_at && (
                        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>
                          ⏱️ Voting ends {formatDistanceToNow(new Date(dispute.ends_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dispute Details and Voting */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 
                  className="text-xl font-bold mb-4"
                  style={{ color: '#1A1A1E' }}
                >
                  Dispute Details
                </h3>

                {/* Opened By */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold" style={{ color: '#6F7280' }}>
                      OPENED BY:
                    </span>
                    <Chip
                      label={dispute.opened_by === 'poster' ? 'Poster' : 'Worker'}
                      size="small"
                      sx={{
                        backgroundColor: dispute.opened_by === 'poster' ? '#EEE7FF' : '#E8F4FF',
                        color: dispute.opened_by === 'poster' ? '#7C4DFF' : '#2563EB',
                        fontWeight: 600
                      }}
                    />
                    <span 
                      className={`text-sm ${(dispute.opened_by === 'poster' && posterHasDisplayName) || (dispute.opened_by !== 'poster' && workerHasDisplayName) ? '' : 'font-mono'}`}
                      style={{ color: '#6F7280' }}
                    >
                      {dispute.opened_by === 'poster' 
                        ? posterDisplayName
                        : job.assigned_to ? workerDisplayName : 'N/A'
                      }
                    </span>
                    <span className="text-sm" style={{ color: '#A3A7B5' }}>
                      • {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Dispute Reason */}
                <div className="mb-4">
                  <h4 
                    className="text-sm font-semibold mb-2"
                    style={{ color: '#1A1A1E' }}
                  >
                    DISPUTE REASON:
                  </h4>
                  <div 
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: '#F9FAFB' }}
                  >
                    <p 
                      className="text-sm whitespace-pre-wrap"
                      style={{ color: '#1A1A1E' }}
                    >
                      {dispute.reason}
                    </p>
                  </div>
                </div>

                {/* Original KPIs (Collapsible) */}
                <details className="mb-4">
                  <summary 
                    className="text-sm font-semibold cursor-pointer hover:text-purple-600"
                    style={{ color: '#7C4DFF' }}
                  >
                    📋 View Original KPIs (for reference)
                  </summary>
                  <div 
                    className="mt-2 p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: '#F9FAFB',
                      borderColor: '#E5E7F0'
                    }}
                  >
                    <p 
                      className="text-sm whitespace-pre-wrap"
                      style={{ color: '#1A1A1E' }}
                    >
                      {job.kpis}
                    </p>
                  </div>
                </details>

                {/* Link to Submission */}
                <div className="mb-6">
                  <a
                    href="#submitted-work"
                    className="text-sm font-medium hover:underline flex items-center gap-1"
                    style={{ color: '#7C4DFF' }}
                  >
                    📦 View submitted work
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </a>
                </div>

                <div 
                  className="h-px mb-6"
                  style={{ backgroundColor: '#E5E7F0' }}
                />

                {/* Current Voting Results */}
                <div className="mb-6">
                  <h4 
                    className="text-lg font-bold mb-4"
                    style={{ color: '#1A1A1E' }}
                  >
                    Current Voting Results
                  </h4>

                  {(() => {
                    // Calculate vote percentages
                    const releaseVotes = disputeVotes.filter(v => v.vote === 'release')
                    const refundVotes = disputeVotes.filter(v => v.vote === 'refund')
                    
                    const releaseWeight = releaseVotes.reduce((sum, v) => sum + v.vote_weight, 0)
                    const refundWeight = refundVotes.reduce((sum, v) => sum + v.vote_weight, 0)
                    const totalWeight = releaseWeight + refundWeight
                    
                    const releasePercent = totalWeight > 0 ? (releaseWeight / 100) * 100 : 0
                    const refundPercent = totalWeight > 0 ? (refundWeight / 100) * 100 : 0
                    const notVotedPercent = 100 - releasePercent - refundPercent

                    const isReleaseWinning = releaseWeight > refundWeight

                    return (
                      <>
                        {/* Release to Worker Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold" style={{ color: '#7C4DFF' }}>
                              Release to Worker
                            </span>
                            <span className="text-sm font-bold" style={{ color: '#7C4DFF' }}>
                              {releasePercent.toFixed(1)}%
                            </span>
                          </div>
                          <LinearProgress
                            variant="determinate"
                            value={releasePercent}
                            sx={{
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: '#E5E7F0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: '#7C4DFF',
                                borderRadius: 5
                              }
                            }}
                          />
                          <p className="text-xs mt-1" style={{ color: '#6F7280' }}>
                            {releasePercent.toFixed(1)}% of supply voted to release ({releaseVotes.length} voter{releaseVotes.length !== 1 ? 's' : ''})
                          </p>
                        </div>

                        {/* Refund to Poster Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold" style={{ color: '#FB923C' }}>
                              Refund to Poster
                            </span>
                            <span className="text-sm font-bold" style={{ color: '#FB923C' }}>
                              {refundPercent.toFixed(1)}%
                            </span>
                          </div>
                          <LinearProgress
                            variant="determinate"
                            value={refundPercent}
                            sx={{
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: '#E5E7F0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: '#FB923C',
                                borderRadius: 5
                              }
                            }}
                          />
                          <p className="text-xs mt-1" style={{ color: '#6F7280' }}>
                            {refundPercent.toFixed(1)}% of supply voted to refund ({refundVotes.length} voter{refundVotes.length !== 1 ? 's' : ''})
                          </p>
                        </div>

                        {/* Not Voted Yet */}
                        <div className="mb-4">
                          <p className="text-sm" style={{ color: '#6F7280' }}>
                            {notVotedPercent.toFixed(1)}% have not voted yet
                          </p>
                        </div>

                        {/* Current Leader */}
                        {totalWeight > 0 && (
                          <div 
                            className="p-3 rounded-lg"
                            style={{ 
                              backgroundColor: isReleaseWinning ? '#EEE7FF' : '#FFF4E6'
                            }}
                          >
                            <p 
                              className="text-sm font-bold"
                              style={{ color: isReleaseWinning ? '#7C4DFF' : '#FB923C' }}
                            >
                              {isReleaseWinning ? '🟣 Release to Worker is winning' : '🟠 Refund to Poster is winning'}
                            </p>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div 
                  className="h-px mb-6"
                  style={{ backgroundColor: '#E5E7F0' }}
                />

                {/* Your Vote Section */}
                {publicKey && (
                  <div>
                    <h4 
                      className="text-lg font-bold mb-4"
                      style={{ color: '#1A1A1E' }}
                    >
                      {userVote ? 'Your Vote' : 'Cast Your Vote'}
                    </h4>

                    {userVote ? (
                      /* Already Voted */
                      <div 
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: '#E3F8ED' }}
                      >
                        <p className="text-sm font-bold mb-2" style={{ color: '#36C170' }}>
                          ✓ You voted to: {userVote === 'release' ? 'Release to Worker' : 'Refund to Poster'}
                        </p>
                        <p className="text-sm mb-1" style={{ color: '#6F7280' }}>
                          Voting power: {userVoteWeight.toFixed(2)}% of supply
                        </p>
                        <p className="text-sm mb-1" style={{ color: '#6F7280' }}>
                          Karma earned: +{(5 * tierMultiplier).toFixed(1)} karma
                        </p>
                        <p className="text-sm" style={{ color: '#36C170' }}>
                          Bonus if correct: +{(job.payment_amount_usd * 5 * tierMultiplier).toFixed(0)} karma
                        </p>
                      </div>
                    ) : (
                      /* Haven't Voted Yet */
                      <div>
                        <FormControl component="fieldset" className="mb-4">
                          <RadioGroup
                            value={selectedVote}
                            onChange={(e) => setSelectedVote(e.target.value as 'release' | 'refund')}
                          >
                            <FormControlLabel
                              value="release"
                              control={<Radio sx={{ color: '#7C4DFF', '&.Mui-checked': { color: '#7C4DFF' } }} />}
                              label={
                                <div>
                                  <p className="font-semibold" style={{ color: '#1A1A1E' }}>
                                    Release to Worker
                                  </p>
                                  <p className="text-xs" style={{ color: '#6F7280' }}>
                                    The submitted work meets the KPIs
                                  </p>
                                </div>
                              }
                            />
                            <FormControlLabel
                              value="refund"
                              control={<Radio sx={{ color: '#FB923C', '&.Mui-checked': { color: '#FB923C' } }} />}
                              label={
                                <div>
                                  <p className="font-semibold" style={{ color: '#1A1A1E' }}>
                                    Refund to Poster
                                  </p>
                                  <p className="text-xs" style={{ color: '#6F7280' }}>
                                    The submitted work does not meet the KPIs
                                  </p>
                                </div>
                              }
                            />
                          </RadioGroup>
                        </FormControl>

                        <div 
                          className="p-4 rounded-lg mb-4"
                          style={{ backgroundColor: '#F9FAFB' }}
                        >
                          <p className="text-sm mb-1" style={{ color: '#6F7280' }}>
                            Your voting power: <span className="font-bold">{userVoteWeight.toFixed(2)}% of supply</span>
                          </p>
                          <p className="text-sm mb-1" style={{ color: '#6F7280' }}>
                            Your tier: <span className="font-bold">
                              {tierMultiplier === 7 ? 'Mega (7x)' : tierMultiplier === 5.5 ? 'Whale (5.5x)' : tierMultiplier === 3 ? 'Holder (3x)' : 'Small Holder (1x)'}
                            </span>
                          </p>
                          <p className="text-sm font-bold" style={{ color: '#36C170' }}>
                            Vote now: +{(5 * tierMultiplier).toFixed(1)} karma
                          </p>
                          <p className="text-sm font-bold" style={{ color: '#7C4DFF' }}>
                            Bonus if correct: +{(job.payment_amount_usd * 5 * tierMultiplier).toFixed(0)} karma
                          </p>
                        </div>

                        <Button
                          variant="contained"
                          size="large"
                          onClick={handleVote}
                          disabled={voting}
                          className="w-full"
                          sx={{
                            backgroundColor: '#7C4DFF',
                            color: '#fff',
                            textTransform: 'none',
                            fontSize: '16px',
                            py: 1.5,
                            '&:hover': {
                              backgroundColor: '#6B3FEE'
                            },
                            '&:disabled': {
                              backgroundColor: '#E5E7F0',
                              color: '#A3A7B5'
                            }
                          }}
                        >
                          {voting ? (
                            <>
                              <CircularProgress size={20} sx={{ mr: 1, color: '#fff' }} />
                              Submitting Vote...
                            </>
                          ) : (
                            <>
                              <GavelIcon sx={{ fontSize: 20, mr: 1 }} />
                              Submit Vote
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {!publicKey && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <p className="text-sm">
                      Connect your wallet to participate in voting and earn karma rewards!
                    </p>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Job Header Card */}
            <Card>
              <CardContent className="p-6">
                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: statusColors[job.status] }}
                  />
                  <span 
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: statusColors[job.status] }}
                  >
                    {statusLabels[job.status]}
                  </span>
                </div>

                {/* Title */}
                <h1 
                  className="text-4xl font-bold mb-6"
                  style={{ 
                    fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
                    color: '#1A1A1E'
                  }}
                >
                  {job.title}
                </h1>

                {/* Posted By */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm" style={{ color: '#6F7280' }}>
                    Posted by:
                  </span>
                   <span 
                     className={`text-sm font-medium ${posterHasDisplayName ? '' : 'font-mono'}`}
                     style={{ color: '#1A1A1E' }}
                   >
                     {posterDisplayName}
                   </span>
                   <Tooltip title={copiedAddress === job.poster_wallet ? "Copied!" : "Copy address"}>
                     <IconButton
                       size="small"
                       onClick={() => handleCopyAddress(job.poster_wallet)}
                       sx={{ 
                         padding: '2px',
                         color: '#6F7280',
                         '&:hover': { color: '#7C4DFF' }
                       }}
                     >
                       <ContentCopyIcon sx={{ fontSize: 14 }} />
                     </IconButton>
                   </Tooltip>
                   {renderMessageTipButtons(job.poster_wallet)}
                  {posterJobCount > 0 && (
                    <Chip
                      icon={<WorkIcon sx={{ fontSize: 14 }} />}
                      label={`Builder (${posterJobCount} jobs)`}
                      size="small"
                      sx={{
                        backgroundColor: '#E8F4FF',
                        color: '#2563EB',
                        fontWeight: 500,
                        fontSize: '12px'
                      }}
                    />
                  )}
                </div>

                {/* Timestamps */}
                <div className="flex flex-wrap gap-4 text-sm" style={{ color: '#A3A7B5' }}>
                  <div>
                    <span className="font-medium">Posted:</span>{' '}
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </div>
                  {job.updated_at !== job.created_at && (
                    <div>
                      <span className="font-medium">Last updated:</span>{' '}
                      {formatDistanceToNow(new Date(job.updated_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. Job Details Card */}
            <Card>
              <CardContent className="p-6">
                {/* Category */}
                <div className="mb-6">
                  <Chip
                    label={job.category}
                    sx={{
                      backgroundColor: categoryColors[job.category]?.bg || '#F3F4F6',
                      color: categoryColors[job.category]?.text || '#6B7280',
                      fontWeight: 600,
                      fontSize: '14px',
                      textTransform: 'capitalize',
                      height: '32px'
                    }}
                  />
                </div>

                {/* Description */}
                <div className="mb-8">
                  <h3 
                    className="text-lg font-bold mb-3"
                    style={{ color: '#1A1A1E' }}
                  >
                    Description
                  </h3>
                  <div 
                    className="text-base whitespace-pre-wrap"
                    style={{ color: '#1A1A1E', lineHeight: '1.7' }}
                  >
                    {job.description}
                  </div>
                </div>

                {/* Success Criteria / KPIs */}
                <div className="mb-6">
                  <h3 
                    className="text-lg font-bold mb-3"
                    style={{ color: '#1A1A1E' }}
                  >
                    Success Criteria (KPIs)
                  </h3>
                  <div 
                    className="text-base whitespace-pre-wrap"
                    style={{ color: '#1A1A1E', lineHeight: '1.7' }}
                  >
                    {job.kpis}
                  </div>
                </div>

                {/* Assignment Mode */}
                <div 
                  className="flex items-center gap-2 p-4 rounded-lg"
                  style={{ backgroundColor: '#F8F9FC' }}
                >
                  {job.assignment_mode === 'review' ? (
                    <>
                      <SearchIcon sx={{ color: '#7C4DFF', fontSize: 20 }} />
                      <span className="text-sm font-medium" style={{ color: '#1A1A1E' }}>
                        🔍 Reviewing Applications
                      </span>
                      <span className="text-sm" style={{ color: '#6F7280' }}>
                        — Poster will review all applications and choose the best candidate
                      </span>
                    </>
                  ) : (
                    <>
                      <FlashOnIcon sx={{ color: '#FFC857', fontSize: 20 }} />
                      <span className="text-sm font-medium" style={{ color: '#1A1A1E' }}>
                        ⚡ First Come, First Served
                      </span>
                      <span className="text-sm" style={{ color: '#6F7280' }}>
                        — First applicant gets the job immediately
                      </span>
                    </>
                  )}
                </div>

                {/* Deadline Information - Show worker's committed completion or hard deadline */}
                {(job.worker_committed_completion || job.hard_deadline) && job.status === 'assigned' && (
                  (() => {
                    const effectiveDeadline = job.worker_committed_completion || job.hard_deadline
                    const daysUntil = getDaysUntilDeadline(effectiveDeadline!)
                    
                    return (
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          mt: 3,
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: daysUntil < 3 ? '#FEE' : '#F8F5FF'
                        }}
                      >
                        <CalendarTodayIcon 
                          sx={{ 
                            mr: 1.5, 
                            color: daysUntil < 3 ? '#DC2626' : '#7C4DFF',
                            fontSize: 20
                          }} 
                        />
                        <Box>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600, 
                              color: '#1A1A1E',
                              mb: 0.25
                            }}
                          >
                            {daysUntil < 0 ? '🚨 Deadline Passed' : '📅 Expected Completion'}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: daysUntil < 3 ? '#DC2626' : '#6F7280'
                            }}
                          >
                            {formatDeadline(effectiveDeadline!)}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })()
                )}
              </CardContent>
            </Card>

            {/* Waiting for Submission (if assigned and poster) */}
            {job.status === 'assigned' && job.assigned_to && isPoster && (
              <Card 
                className="border-2"
                style={{ borderColor: '#FFC857', backgroundColor: '#FFFBF0' }}
              >
                <CardContent className="p-6">
                  <h3 
                    className="text-lg font-bold mb-3"
                    style={{ color: '#1A1A1E' }}
                  >
                    🟡 Waiting for Submission
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span 
                        className="text-sm"
                        style={{ color: '#6F7280' }}
                      >
                        Assigned to:
                      </span>
                        <div className="flex items-center gap-2 mt-1">
                         <span 
                           className="text-base font-mono font-semibold"
                           style={{ color: '#1A1A1E' }}
                         >
                           {formatWalletAddress(job.assigned_to)}
                         </span>
                         <Tooltip title="Copy address">
                           <IconButton
                             size="small"
                             onClick={() => handleCopyAddress(job.assigned_to!)}
                             sx={{ 
                               padding: '2px',
                               color: '#6F7280',
                               '&:hover': { color: '#7C4DFF' }
                             }}
                           >
                             <ContentCopyIcon sx={{ fontSize: 14 }} />
                           </IconButton>
                         </Tooltip>
                         {renderMessageTipButtons(job.assigned_to)}
                        </div>
                    </div>
                    {job.assigned_at && applications.find(a => a.applicant_wallet === job.assigned_to) && (
                      <>
                        <div>
                          <span 
                            className="text-sm"
                            style={{ color: '#6F7280' }}
                          >
                            Expected completion:
                          </span>
                          <div 
                            className="text-base font-semibold mt-1"
                            style={{ color: '#1A1A1E' }}
                          >
                            {format(
                              getExpectedCompletionDate(
                                applications.find(a => a.applicant_wallet === job.assigned_to)!.estimated_completion
                              ),
                              'MMMM dd, yyyy'
                            )}
                          </div>
                        </div>
                        {/* Revision Counter - Poster View */}
                        <RevisionCounter
                          application={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
                          size="medium"
                          isWorkerView={false}
                        />

                        {/* Revision Refusal Dispute Option - Show when revision pending for 24+ hours */}
                        {latestRevisionRequest && (() => {
                          const hoursSinceRequest = Math.floor(
                            (Date.now() - new Date(latestRevisionRequest.requestedAt).getTime()) / (1000 * 60 * 60)
                          )
                          if (hoursSinceRequest >= 24) {
                            return (
                              <Alert 
                                severity="warning" 
                                sx={{ mt: 2, backgroundColor: '#FFF4E6' }}
                                action={
                                  <Button
                                    size="small"
                                    color="inherit"
                                    onClick={() => setShowRevisionDisputeModal(true)}
                                    sx={{ 
                                      fontWeight: 600,
                                      textTransform: 'none'
                                    }}
                                  >
                                    Open Dispute
                                  </Button>
                                }
                              >
                                <AlertTitle sx={{ fontWeight: 600 }}>Revision Pending ({hoursSinceRequest}+ hours)</AlertTitle>
                                Worker has not responded to your revision request. You can open a dispute.
                              </Alert>
                            )
                          }
                          return null
                        })()}
                      </>
                    )}
                    <div 
                      className="text-sm pt-2"
                      style={{ color: '#6F7280' }}
                    >
                      Assigned {job.assigned_at && formatDistanceToNow(new Date(job.assigned_at), { addSuffix: true })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deadline Reminder for Worker - Use worker_committed_completion if available */}
            {job.status === 'assigned' && 
             job.assigned_to === publicKey?.toString() && 
             (job.worker_committed_completion || job.hard_deadline) && (
              (() => {
                // Use worker's committed completion date if available, otherwise fall back to hard_deadline
                const effectiveDeadline = job.worker_committed_completion || job.hard_deadline
                const daysUntil = getDaysUntilDeadline(effectiveDeadline!)
                
                return (
                  <Alert 
                    severity={daysUntil < 3 ? 'error' : 'warning'}
                    sx={{ 
                      mb: 3,
                      backgroundColor: daysUntil < 3 ? '#FEE' : '#FFF4E6',
                      '& .MuiAlert-icon': {
                        color: daysUntil < 3 ? '#DC2626' : '#FB923C'
                      }
                    }}
                  >
                    <AlertTitle sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                      {daysUntil < 3 ? '🚨 Urgent Deadline' : '⏰ Your Delivery Deadline'}
                    </AlertTitle>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      <strong>Expected completion:</strong> {formatDeadline(effectiveDeadline!)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: daysUntil < 3 ? 1 : 0 }}>
                      {daysUntil > 0 
                        ? `${daysUntil} ${daysUntil === 1 ? 'day' : 'days'} remaining to submit your work`
                        : 'Deadline has passed - submit immediately to avoid penalties'}
                    </Typography>
                    {daysUntil < 3 && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          mt: 1, 
                          fontWeight: 600,
                          color: daysUntil < 0 ? '#DC2626' : '#1A1A1E'
                        }}
                      >
                        ⚠️ Missing this deadline without submission will result in job cancellation and karma penalties
                      </Typography>
                    )}
                  </Alert>
                )
              })()
            )}

            {/* Missed Deadline Alert for Poster - Use worker_committed_completion if available */}
            {job.status === 'assigned' && 
             job.poster_wallet === publicKey?.toString() &&
             (job.worker_committed_completion || job.hard_deadline) &&
             getDaysUntilDeadline(job.worker_committed_completion || job.hard_deadline!) < 0 &&
             !job.submitted_at && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mb: 3,
                  backgroundColor: '#FFF4E6',
                  '& .MuiAlert-icon': {
                    color: '#FB923C'
                  }
                }}
              >
                <AlertTitle sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                  ⚠️ Worker Missed Deadline
                </AlertTitle>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  The worker has not submitted work by the committed deadline ({formatDeadline(job.worker_committed_completion || job.hard_deadline!)}).
                  You can now cancel this job and receive a full refund.
                </Typography>
                <Button 
                  variant="contained" 
                  onClick={handleCancel}
                  sx={{
                    backgroundColor: '#FB923C',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#F97316'
                    }
                  }}
                >
                  Cancel Job & Get Refund
                </Button>
              </Alert>
            )}

            {/* Work Submission Card (if submitted) */}
            {(job.status === 'submitted' || job.status === 'completed' || job.status === 'disputed') && submission && (
              <Card id="submitted-work">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: '#1A1A1E' }}
                    >
                      {job.status === 'completed' ? '✓ Completed Work' : '📦 Submitted Work'}
                    </h3>
                    {job.status === 'submitted' && (
                      <Chip
                        label="Under Review"
                        sx={{
                          backgroundColor: '#FFF4E6',
                          color: '#FB923C',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}
                      />
                    )}
                  </div>

                  {/* Submitted by */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm" style={{ color: '#6F7280' }}>
                      Submitted by:
                    </span>
                     <span 
                       className="text-sm font-mono font-semibold"
                       style={{ color: '#1A1A1E' }}
                     >
                       {formatWalletAddress(submission.worker_wallet)}
                     </span>
                     <Tooltip title="Copy address">
                       <IconButton
                         size="small"
                         onClick={() => handleCopyAddress(submission.worker_wallet)}
                         sx={{ 
                           padding: '2px',
                           color: '#6F7280',
                           '&:hover': { color: '#7C4DFF' }
                         }}
                       >
                         <ContentCopyIcon sx={{ fontSize: 14 }} />
                       </IconButton>
                     </Tooltip>
                     {renderMessageTipButtons(submission.worker_wallet)}
                    <span className="text-sm" style={{ color: '#6F7280' }}>
                      {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {/* Revision Counter - Shows revision status for submitted work */}
                  {job.assigned_to && job.status === 'submitted' && (
                    <div className="mb-6">
                      <RevisionCounter
                        application={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
                        size="medium"
                        isWorkerView={isAssignedWorker}
                      />
                    </div>
                  )}

                  {/* Delivery Message */}
                  <div className="mb-6">
                    <h4 
                      className="text-sm font-semibold mb-2"
                      style={{ color: '#6F7280' }}
                    >
                      DELIVERY MESSAGE
                    </h4>
                    <div 
                      className="text-base whitespace-pre-wrap"
                      style={{ 
                        color: '#1A1A1E',
                        lineHeight: '1.7',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      {submission.message}
                    </div>
                  </div>

                  {/* Deliverable Images */}
                  {submission.image_urls && submission.image_urls.length > 0 && (
                    <div className="mb-6">
                      <h4 
                        className="text-sm font-semibold mb-3"
                        style={{ color: '#6F7280' }}
                      >
                        DELIVERABLE IMAGES
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {submission.image_urls.map((url, index) => (
                          <div 
                            key={index}
                            className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-purple-400 transition-colors"
                            onClick={() => setLightboxImage({ url, index })}
                          >
                            <img
                              src={url}
                              alt={`Deliverable ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div 
                              className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 px-2 text-center"
                            >
                              Image {index + 1} of {submission.image_urls.length}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* External Links */}
                  {submission.external_links && submission.external_links.length > 0 && (
                    <div className="mb-6">
                      <h4 
                        className="text-sm font-semibold mb-3"
                        style={{ color: '#6F7280' }}
                      >
                        EXTERNAL LINKS
                      </h4>
                      
                      {/* Warning */}
                      <div 
                        className="flex items-start gap-2 p-3 rounded-lg mb-3"
                        style={{ backgroundColor: '#FFF4E6' }}
                      >
                        <WarningIcon sx={{ fontSize: 18, color: '#FB923C', mt: '2px' }} />
                        <p className="text-sm" style={{ color: '#1A1A1E' }}>
                          Verify links before opening. Scan downloads for malware.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {submission.external_links.map((link, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-3 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-blue-500">🔗</span>
                              <span 
                                className="text-sm font-mono truncate"
                                style={{ color: '#1A1A1E' }}
                                title={link}
                              >
                                {truncateUrl(link, 50)}
                              </span>
                            </div>
                            <Button
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="outlined"
                              size="small"
                              sx={{
                                textTransform: 'none',
                                color: '#7C4DFF',
                                borderColor: '#7C4DFF',
                                '&:hover': {
                                  borderColor: '#6B3FEE',
                                  backgroundColor: '#F8F5FF'
                                }
                              }}
                            >
                              Open
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-Release Timer (if still submitted) */}
                  {job.status === 'submitted' && job.submitted_at && (
                    <div 
                      className="p-4 rounded-lg mb-4"
                      style={{ 
                        backgroundColor: isAutoReleaseUrgent(job.submitted_at) ? '#FFF4E6' : '#F8F9FC'
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 
                          className="text-sm font-semibold"
                          style={{ color: isAutoReleaseUrgent(job.submitted_at) ? '#FB923C' : '#6F7280' }}
                        >
                          AUTO-RELEASE COUNTDOWN
                        </h4>
                        <span 
                          className="text-lg font-bold"
                          style={{ color: isAutoReleaseUrgent(job.submitted_at) ? '#FB923C' : '#7C4DFF' }}
                        >
                          {getTimeUntilAutoRelease(job.submitted_at)}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#6F7280' }}>
                        Payment will automatically release to worker if no action taken
                      </p>
                    </div>
                  )}

                  {/* Poster Actions */}
                  {job.status === 'submitted' && isPoster && (
                    <div className="space-y-4">
                      {/* Primary Actions - Stack on mobile, row on desktop */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Release Payment - Success Green */}
                        <MuiButton
                          variant="contained"
                          onClick={() => setShowReleaseConfirm(true)}
                          startIcon={<CheckCircleIcon />}
                          fullWidth
                          sx={{
                            flex: { sm: 1 },
                            backgroundColor: '#36C170',
                            color: '#fff',
                            textTransform: 'none',
                            fontSize: { xs: '16px', sm: '15px' },
                            fontWeight: 600,
                            py: { xs: 1.75, sm: 1.5 },
                            px: 3,
                            borderRadius: '12px',
                            boxShadow: '0 8px 20px 0 rgba(54, 193, 112, 0.3)',
                            minHeight: { xs: '52px', sm: 'auto' },
                            '&:hover': {
                              backgroundColor: '#2DA862',
                              boxShadow: '0 12px 24px 0 rgba(54, 193, 112, 0.4)',
                            }
                          }}
                        >
                          ✓ Release Payment
                        </MuiButton>
                        
                        {/* Request Revision - Warning Yellow */}
                        <MuiButton
                          variant="contained"
                          onClick={() => setShowRevisionModal(true)}
                          startIcon={<LoopIcon />}
                          fullWidth
                          sx={{
                            flex: { sm: 1 },
                            backgroundColor: '#FFC857',
                            color: '#1A1A1E',
                            textTransform: 'none',
                            fontSize: { xs: '16px', sm: '15px' },
                            fontWeight: 600,
                            py: { xs: 1.75, sm: 1.5 },
                            px: 3,
                            borderRadius: '12px',
                            boxShadow: '0 8px 20px 0 rgba(255, 200, 87, 0.3)',
                            minHeight: { xs: '52px', sm: 'auto' },
                            '&:hover': {
                              backgroundColor: '#F5B83D',
                              boxShadow: '0 12px 24px 0 rgba(255, 200, 87, 0.4)',
                            }
                          }}
                        >
                          Request Revision
                        </MuiButton>
                      </div>
                      
                      {/* Dispute Link - Subtle text button */}
                      <MuiButton
                        variant="text"
                        onClick={handleOpenDispute}
                        fullWidth
                        sx={{
                          color: '#6F7280',
                          textTransform: 'none',
                          fontSize: '14px',
                          fontWeight: 500,
                          py: 1,
                          '&:hover': {
                            color: '#EF4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          }
                        }}
                      >
                        Not satisfied? Open a Dispute →
                      </MuiButton>
                    </div>
                  )}

                  {/* Worker View */}
                  {job.status === 'submitted' && isAssignedWorker && (
                    <div 
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: '#F8F5FF' }}
                    >
                      <div className="text-center mb-4">
                        <p 
                          className="text-base font-semibold mb-2"
                          style={{ color: '#7C4DFF' }}
                        >
                          ✅ Work Submitted - Under Review
                        </p>
                        <p className="text-sm" style={{ color: '#6F7280' }}>
                          Auto-releases in: {getTimeUntilAutoRelease(job.submitted_at || '')}
                        </p>
                      </div>
                      
                      {/* Add More Information Button */}
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitWork}
                        className="w-full shadow-lg"
                      >
                        📎 Add More Information
                      </Button>
                      <p className="text-xs text-center mt-2" style={{ color: '#A3A7B5' }}>
                        Update your submission with additional files or details
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column (1/3 width) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Voting Bonus Info (only for open review jobs) */}
            {job.status === 'open' && job.assignment_mode === 'review' && publicKey && !isPoster && (
              <Card style={{ borderColor: '#E5DEFF', borderWidth: '2px' }}>
                <CardContent className="p-5" style={{ backgroundColor: '#FEFBFF' }}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">💎</span>
                    <div>
                      <h4 
                        className="text-sm font-bold mb-1"
                        style={{ color: '#7C4DFF' }}
                      >
                        Earn Bonus Karma!
                      </h4>
                      <p className="text-xs leading-relaxed" style={{ color: '#1A1A1E' }}>
                        Vote for the applicant you think will deliver best work. If they're chosen AND successfully complete the job, you'll earn:
                      </p>
                    </div>
                  </div>
                  <div 
                    className="p-3 rounded-lg text-center"
                    style={{ backgroundColor: '#F8F5FF' }}
                  >
                    <div className="text-lg font-bold" style={{ color: '#7C4DFF' }}>
                      ${job.payment_amount_usd.toFixed(0)} × 5 × tier
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#6F7280' }}>
                      = {(job.payment_amount_usd * 5).toFixed(0)}+ bonus karma
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2. Payment Card */}
            {!job.is_contest && !job.is_social_media_job && (
              <Card 
                className="border-4"
                style={{ borderColor: '#E3F06F' }}
              >
                <CardContent className="p-6">
                  <h3 
                    className="text-sm font-semibold uppercase tracking-wide mb-4"
                    style={{ color: '#6F7280' }}
                  >
                    Payment
                  </h3>
                  
                  <div className="mb-2">
                    <div 
                      className="text-3xl font-bold mb-1"
                      style={{ color: '#7C4DFF' }}
                    >
                      {job.payment_amount_tokens.toLocaleString()} {project.token_symbol}
                    </div>
                    <div 
                      className="text-lg"
                      style={{ color: '#6F7280' }}
                    >
                      (${job.payment_amount_usd.toLocaleString()} USD at posting)
                    </div>
                  </div>

                  <div 
                    className="flex items-start gap-2 mt-4 p-3 rounded-lg"
                    style={{ backgroundColor: '#FFF4E6' }}
                  >
                    <LockIcon sx={{ fontSize: 18, color: '#FB923C', mt: '2px' }} />
                    <div className="text-sm" style={{ color: '#1A1A1E' }}>
                      <strong>Note:</strong> Locked in escrow — released on completion
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 4. Actions Section - Hidden for contests and social media jobs */}
            {!job.is_contest && !job.is_social_media_job && (
            <Card>
              <CardContent className="p-6">
                <h3 
                  className="text-sm font-semibold uppercase tracking-wide mb-4"
                  style={{ color: '#6F7280' }}
                >
                  Actions
                </h3>

                {/* If user has already applied */}
                {hasAlreadyApplied && !isPoster && (
                  <div 
                    className="p-4 rounded-lg text-center"
                    style={{ backgroundColor: '#F0F9FF', borderLeft: '4px solid #3B82F6' }}
                  >
                    <p className="text-sm font-medium" style={{ color: '#1E40AF' }}>
                      ✓ You've already applied for this job
                    </p>
                    <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                      The poster will review your application and may contact you.
                    </p>
                  </div>
                )}

                {/* If job is Open/Assigned and user is NOT poster and hasn't applied */}
                {canApply && (
                  <div className="space-y-3">
                    {job.status === 'assigned' && (
                      <div 
                        className="p-3 rounded-lg mb-2"
                        style={{ backgroundColor: '#FFF4E6', borderLeft: '4px solid #FB923C' }}
                      >
                        <p className="text-sm font-medium" style={{ color: '#1A1A1E' }}>
                          ⚠️ This job is currently assigned. Apply as backup in case the current worker doesn't deliver.
                        </p>
                      </div>
                    )}
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleApply}
                      className="w-full shadow-lg"
                    >
                      {job.status === 'assigned' ? 'Apply as Backup' : 'Apply for This Job'}
                    </Button>
                    <p 
                      className="text-sm text-center"
                      style={{ color: '#36C170' }}
                    >
                      ✨ You'll earn +50 karma for applying
                    </p>
                  </div>
                )}

                {/* If job is Open and user IS poster */}
                {job.status === 'open' && isPoster && (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleEdit}
                      className="w-full"
                    >
                      Edit Job
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="w-full"
                      style={{ color: '#EF4444', borderColor: '#EF4444' }}
                    >
                      Cancel Job
                    </Button>
                  </div>
                )}

                {/* If job is Assigned and user IS poster */}
                {job.status === 'assigned' && isPoster && (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowReassignDialog(true)}
                      className="w-full"
                      style={{ color: '#FB923C', borderColor: '#FB923C' }}
                    >
                      🔄 Reassign Job
                    </Button>
                    <p 
                      className="text-xs text-center"
                      style={{ color: '#6F7280' }}
                    >
                      Reassign if worker hasn't delivered
                    </p>
                  </div>
                )}

                {/* If user is assigned worker */}
                {isAssignedWorker && (job.status === 'assigned' || job.status === 'submitted') && (
                  <div className="space-y-3">
                    {/* Show Submit Work only for initial submission (no revision request pending) */}
                    {job.status === 'assigned' && !latestRevisionRequest && (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitWork}
                        className="w-full shadow-lg"
                      >
                        Submit Work
                      </Button>
                    )}
                    {/* Show Upload Revised Work when revision is requested */}
                    {job.status === 'assigned' && latestRevisionRequest && (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitWork}
                        className="w-full shadow-lg"
                      >
                        🔄 Upload Revised Work
                      </Button>
                    )}
                    {job.status === 'submitted' && (
                      <div 
                        className="p-4 rounded-lg text-center"
                        style={{ backgroundColor: '#EEE7FF' }}
                      >
                        <div className="text-lg font-semibold mb-1" style={{ color: '#7C4DFF' }}>
                          Work Submitted
                        </div>
                        <div className="text-sm" style={{ color: '#6F7280' }}>
                          Waiting for poster to review
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* If not logged in */}
                {!publicKey && job.status === 'open' && (
                  <div 
                    className="p-4 rounded-lg text-center"
                    style={{ backgroundColor: '#F8F9FC' }}
                  >
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      Connect your wallet to apply for this job
                    </p>
                  </div>
                )}

                {/* If job is completed */}
                {job.status === 'completed' && (
                  <div 
                    className="p-4 rounded-lg text-center"
                    style={{ backgroundColor: '#E3F8ED' }}
                  >
                    <div className="text-lg font-semibold mb-1" style={{ color: '#36C170' }}>
                      ✓ Completed
                    </div>
                    <div className="text-sm" style={{ color: '#6F7280' }}>
                      This job has been completed
                    </div>
                  </div>
                )}

                {/* If job is cancelled */}
                {job.status === 'cancelled' && (
                  <div 
                    className="p-4 rounded-lg text-center"
                    style={{ backgroundColor: '#FEE' }}
                  >
                    <div className="text-lg font-semibold mb-1" style={{ color: '#EF4444' }}>
                      Cancelled
                    </div>
                    <div className="text-sm" style={{ color: '#6F7280' }}>
                      This job was cancelled by the poster
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        </div>

        {/* 5. Applications Section (Regular Jobs Only) */}
        {!job.is_contest && !job.is_social_media_job && (
        <Card className="mt-6">
          <CardContent className="p-6">
            {/* Header - changes based on status */}
            {job.status === 'assigned' && job.assigned_to ? (
              <div className="mb-6">
                <h2 
                  className="text-2xl font-bold mb-2"
                  style={{ 
                    fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
                    color: '#1A1A1E'
                  }}
                >
                  Assigned to:
                </h2>
                {applications.length > 1 && (
                  <p className="text-sm" style={{ color: '#6F7280' }}>
                    {applications.length - 1} backup applicant{applications.length > 2 ? 's' : ''} available if needed
                  </p>
                )}
              </div>
            ) : (
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ 
                  fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
                  color: '#1A1A1E'
                }}
              >
                Applications {applications.length > 0 && `(${applications.length})`}
              </h2>
            )}

            {/* Voting Info Banner */}
            {job.status === 'open' && applications.length > 0 && publicKey && !isPoster && (
              <div 
                className="mb-4 p-3 rounded-lg border-2"
                style={{ 
                  backgroundColor: '#F8F5FF',
                  borderColor: '#E5DEFF'
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">💎</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1" style={{ color: '#7C4DFF' }}>
                      Earn Bonus Karma by Voting
                    </p>
                    <p className="text-xs" style={{ color: '#6F7280' }}>
                      Upvote applicants you think will deliver best. If your pick gets chosen AND completes the job, you'll earn <strong>${job.payment_amount_usd.toFixed(0)} × 5 × tier multiplier</strong> bonus karma!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sort & Filter Controls */}
            {job.status === 'open' && applications.length > 1 && (
              <div className="mb-6 space-y-3">
                {/* Sort Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <span 
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: '#6F7280' }}
                  >
                    SORT BY:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={sortBy === 'votes' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setSortBy('votes')}
                      sx={{
                        textTransform: 'none',
                        fontSize: '14px',
                        height: '32px',
                        backgroundColor: sortBy === 'votes' ? '#7C4DFF' : 'transparent',
                        color: sortBy === 'votes' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        '&:hover': {
                          backgroundColor: sortBy === 'votes' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    >
                      Community Votes
                    </Button>
                    <Button
                      variant={sortBy === 'karma' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setSortBy('karma')}
                      sx={{
                        textTransform: 'none',
                        fontSize: '14px',
                        height: '32px',
                        backgroundColor: sortBy === 'karma' ? '#7C4DFF' : 'transparent',
                        color: sortBy === 'karma' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        '&:hover': {
                          backgroundColor: sortBy === 'karma' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    >
                      Karma
                    </Button>
                    <Button
                      variant={sortBy === 'revisions' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setSortBy('revisions')}
                      startIcon={<LoopIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: '14px',
                        height: '32px',
                        backgroundColor: sortBy === 'revisions' ? '#7C4DFF' : 'transparent',
                        color: sortBy === 'revisions' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        '&:hover': {
                          backgroundColor: sortBy === 'revisions' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    >
                      Most Revisions
                    </Button>
                    <Button
                      variant={sortBy === 'recent' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setSortBy('recent')}
                      sx={{
                        textTransform: 'none',
                        fontSize: '14px',
                        height: '32px',
                        backgroundColor: sortBy === 'recent' ? '#7C4DFF' : 'transparent',
                        color: sortBy === 'recent' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        '&:hover': {
                          backgroundColor: sortBy === 'recent' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    >
                      Most Recent
                    </Button>
                  </div>
                </div>

                {/* Revision Filter */}
                <div className="flex flex-wrap items-center gap-3">
                  <span 
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: '#6F7280' }}
                  >
                    FILTER REVISIONS:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      label="All"
                      onClick={() => setRevisionFilter('all')}
                      variant={revisionFilter === 'all' ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: revisionFilter === 'all' ? '#7C4DFF' : 'transparent',
                        color: revisionFilter === 'all' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: revisionFilter === 'all' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    />
                    <Chip
                      label="3+ revisions"
                      onClick={() => setRevisionFilter('3+')}
                      variant={revisionFilter === '3+' ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: revisionFilter === '3+' ? '#7C4DFF' : 'transparent',
                        color: revisionFilter === '3+' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: revisionFilter === '3+' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    />
                    <Chip
                      label="5+ revisions"
                      onClick={() => setRevisionFilter('5+')}
                      variant={revisionFilter === '5+' ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: revisionFilter === '5+' ? '#7C4DFF' : 'transparent',
                        color: revisionFilter === '5+' ? '#fff' : '#7C4DFF',
                        borderColor: '#7C4DFF',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: revisionFilter === '5+' ? '#6B3FEE' : '#F8F5FF'
                        }
                      }}
                    />
                    <Chip
                      icon={<AllInclusiveIcon sx={{ fontSize: 14 }} />}
                      label="Unlimited only"
                      onClick={() => setRevisionFilter('unlimited')}
                      variant={revisionFilter === 'unlimited' ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: revisionFilter === 'unlimited' ? '#FB923C' : 'transparent',
                        color: revisionFilter === 'unlimited' ? '#fff' : '#FB923C',
                        borderColor: '#FB923C',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: revisionFilter === 'unlimited' ? '#EA7C1F' : '#FFF4E6'
                        },
                        '& .MuiChip-icon': {
                          color: revisionFilter === 'unlimited' ? '#fff' : '#FB923C'
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Applications List */}
            {applications.length === 0 ? (
              <div 
                className="text-center py-12"
                style={{ color: '#A3A7B5' }}
              >
                <p className="text-lg">
                  No applications yet
                </p>
                {job.assignment_mode === 'first_come' && job.status === 'open' && (
                  <p className="text-sm mt-2">
                    ⚡ First applicant will be auto-assigned
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {getSortedApplications().map((app) => {
                  const isAssigned = job.assigned_to === app.applicant_wallet
                  const isOtherAssigned = job.status === 'assigned' && !isAssigned
                  const votes = applicationVotes[app.id] || { totalWeight: 0, voterCount: 0, hasVoted: false }
                  
                  return (
                    <div
                      key={app.id}
                      className={`border-2 rounded-lg p-6 transition-all ${
                        isAssigned
                          ? 'border-green-500 bg-green-50'
                          : isOtherAssigned
                          ? 'border-gray-200 bg-gray-50 opacity-60'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {/* Applicant Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span 
                               className="text-lg font-mono font-semibold"
                               style={{ color: '#1A1A1E' }}
                             >
                               {formatWalletAddress(app.applicant_wallet)}
                             </span>
                             <Tooltip title="Copy address">
                               <IconButton
                                 size="small"
                                 onClick={() => handleCopyAddress(app.applicant_wallet)}
                                 sx={{ 
                                   padding: '2px',
                                   color: '#6F7280',
                                   '&:hover': { color: '#7C4DFF' }
                                 }}
                               >
                                 <ContentCopyIcon sx={{ fontSize: 14 }} />
                               </IconButton>
                             </Tooltip>
                             {renderMessageTipButtons(app.applicant_wallet)}
                            {app.applicant_completed_jobs > 0 && (
                              <SupporterBadge 
                                completedJobsCount={app.applicant_completed_jobs} 
                                size="small" 
                              />
                            )}
                            {isAssigned && (
                              <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                                label="Assigned"
                                size="small"
                                sx={{
                                  backgroundColor: '#36C170',
                                  color: 'white',
                                  fontWeight: 600,
                                  fontSize: '12px'
                                }}
                              />
                            )}
                            {/* Show "Backup" badge for applications submitted after job was assigned */}
                            {!isAssigned && job.assigned_at && new Date(app.created_at) > new Date(job.assigned_at) && (
                              <Chip
                                label="Backup"
                                size="small"
                                sx={{
                                  backgroundColor: '#FFF4E6',
                                  color: '#FB923C',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  border: '1px solid #FB923C'
                                }}
                              />
                            )}
                          </div>
                          
                          {/* Stats */}
                          <div className="flex flex-wrap gap-3 text-sm">
                            <div className="flex items-center gap-1">
                              <span style={{ color: '#6F7280' }}>Karma:</span>
                              <span 
                                className="font-semibold"
                                style={{ color: '#7C4DFF' }}
                              >
                                {app.applicant_karma?.toLocaleString() || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span style={{ color: '#6F7280' }}>Completed Jobs:</span>
                              <span 
                                className="font-semibold"
                                style={{ color: '#36C170' }}
                              >
                                {app.applicant_completed_jobs || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span style={{ color: '#6F7280' }}>Estimated:</span>
                              <span 
                                className="font-semibold"
                                style={{ color: '#1A1A1E' }}
                              >
                                {app.estimated_completion}
                              </span>
                            </div>
                            {/* Revision Offering Badge */}
                            {app.revisions_offered && (
                              <Chip
                                icon={app.revisions_offered === 'unlimited' 
                                  ? <AllInclusiveIcon sx={{ fontSize: 14 }} />
                                  : <LoopIcon sx={{ fontSize: 14 }} />
                                }
                                label={`Offers ${formatRevisionOffering(app.revisions_offered)}`}
                                size="small"
                                sx={{
                                  backgroundColor: app.revisions_offered === 'unlimited' 
                                    ? '#FFF4E6' 
                                    : '#EEE7FF',
                                  color: app.revisions_offered === 'unlimited' 
                                    ? '#FB923C' 
                                    : '#7C4DFF',
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  border: app.revisions_offered === 'unlimited' 
                                    ? '1px solid #FB923C' 
                                    : '1px solid #7C4DFF',
                                  '& .MuiChip-icon': {
                                    color: app.revisions_offered === 'unlimited' 
                                      ? '#FB923C' 
                                      : '#7C4DFF'
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Upvote and Pick Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Upvote Button */}
                          {job.status === 'open' && publicKey && !isPoster && (
                            <Tooltip 
                              title={votes.hasVoted ? "Already voted" : `Vote for this applicant. If they're chosen and deliver, you earn ${(job.payment_amount_usd * 5).toFixed(0)}+ bonus karma!`}
                              arrow
                            >
                              <span>
                                <Button
                                  variant={votes.hasVoted ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => handleUpvote(app.id)}
                                  disabled={upvoting === app.id || votes.hasVoted}
                                  startIcon={<ThumbUpIcon sx={{ fontSize: 18 }} />}
                                  className={`min-w-[110px] font-body ${votes.hasVoted ? 'cursor-default' : ''}`}
                                >
                                  {upvoting === app.id ? (
                                    <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <span className="font-semibold">{votes.totalWeight.toFixed(2)}%</span>
                                      <span className="text-xs opacity-75">({votes.voterCount})</span>
                                    </span>
                                  )}
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                          {/* Pick Button - only show if job is open AND no one is assigned yet */}
                          {isPoster && job.status === 'open' && job.assignment_mode === 'review' && !job.assigned_to && (
                            <Button
                              variant="primary"
                              onClick={() => handlePickApplicant(app)}
                              className="shadow-md"
                            >
                              Pick This Applicant
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Vote Status Display - NEW */}
                      {votes.totalWeight > 0 && (
                        <div 
                          className="mb-3 p-3 rounded-lg"
                          style={{ backgroundColor: '#F8F5FF' }}
                        >
                          <div className="flex items-center gap-2">
                            <ThumbUpIcon sx={{ fontSize: 18, color: '#7C4DFF' }} />
                            <span className="text-sm font-medium" style={{ color: '#7C4DFF' }}>
                              <strong>{votes.totalWeight.toFixed(2)}%</strong> of token supply upvoted this
                            </span>
                            <span className="text-xs" style={{ color: '#6F7280' }}>
                              ({votes.voterCount} {votes.voterCount === 1 ? 'voter' : 'voters'})
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Pitch */}
                      <div className="mb-3">
                        <h4 
                          className="text-sm font-semibold mb-2"
                          style={{ color: '#6F7280' }}
                        >
                          Application Pitch:
                        </h4>
                        <div 
                          className="text-base whitespace-pre-wrap"
                          style={{ color: '#1A1A1E' }}
                        >
                          {app.pitch}
                        </div>
                      </div>

                      {/* Portfolio Images */}
                      {app.image_urls && app.image_urls.length > 0 && (
                        <div>
                          <h4 
                            className="text-sm font-semibold mb-2"
                            style={{ color: '#6F7280' }}
                          >
                            Portfolio:
                          </h4>
                          <div className="flex gap-2 flex-wrap">
                            {app.image_urls.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Portfolio ${idx + 1}`}
                                className="w-24 h-24 object-cover rounded border border-gray-200"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Applied timestamp */}
                      <div 
                        className="text-sm mt-4"
                        style={{ color: '#A3A7B5' }}
                      >
                        Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Waiting for Submission Section (if assigned - includes initial submission OR revision needed) */}
            {job.status === 'assigned' && job.assigned_to && isAssignedWorker && (
              <div 
                className="mt-6 p-6 rounded-xl border-2"
                style={{ 
                  borderColor: latestRevisionRequest ? '#FB923C' : '#7C4DFF', 
                  backgroundColor: latestRevisionRequest ? '#FFF7ED' : '#F8F5FF' 
                }}
              >
                <div className="text-center">
                  {/* Check if there's a pending revision request */}
                  {latestRevisionRequest ? (
                    <>
                      {/* Clear Header for Revision */}
                      <div className="mb-4">
                        <div 
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
                          style={{ backgroundColor: '#FB923C', color: 'white' }}
                        >
                          <LoopIcon sx={{ fontSize: 20 }} />
                          <span className="font-bold">
                            {latestRevisionRequest.isVoluntary 
                              ? 'Revision Requested (Voluntary)' 
                              : `Revision #${latestRevisionRequest.revisionNumber} Required`
                            }
                          </span>
                        </div>
                        <p 
                          className="text-sm font-medium"
                          style={{ color: '#1A1A1E' }}
                        >
                          The poster has requested changes to your submission
                        </p>
                      </div>

                      {/* Poster's Feedback Box */}
                      <div 
                        className="p-4 rounded-lg mb-4 text-left"
                        style={{ 
                          backgroundColor: 'white',
                          border: '1px solid #E5E7F0'
                        }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6F7280' }}>
                          📝 Poster's Feedback:
                        </p>
                        <p 
                          className="text-sm whitespace-pre-wrap"
                          style={{ color: '#1A1A1E' }}
                        >
                          {latestRevisionRequest.notes.length > 300 
                            ? latestRevisionRequest.notes.slice(0, 300) + '...' 
                            : latestRevisionRequest.notes
                          }
                        </p>
                        {latestRevisionRequest.images && latestRevisionRequest.images.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            <span className="text-xs" style={{ color: '#6F7280' }}>Reference images:</span>
                            {latestRevisionRequest.images.slice(0, 3).map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-orange-400 transition-colors"
                              >
                                <img src={url} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-xs mt-2" style={{ color: '#A3A7B5' }}>
                          Requested {formatDistanceToNow(new Date(latestRevisionRequest.requestedAt), { addSuffix: true })}
                        </p>
                      </div>

                      {/* Instructions */}
                      <div 
                        className="p-3 rounded-lg mb-4 text-left"
                        style={{ backgroundColor: '#EEE7FF' }}
                      >
                        <p className="text-sm" style={{ color: '#7C4DFF' }}>
                          <strong>What to do:</strong> Address the feedback above and submit your updated work. 
                          Your submission will replace the previous one.
                        </p>
                      </div>

                      {/* Revision Counter */}
                      <div className="mb-4 w-full max-w-md mx-auto">
                        <RevisionCounter
                          application={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
                          size="small"
                          isWorkerView={true}
                        />
                      </div>

                      {/* Submit Revision Button - Prominent */}
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitWork}
                        className="shadow-lg"
                      >
                        🔄 Upload Revised Work
                      </Button>

                      {/* Abuse Dispute Option - Only show for unlimited revisions with high usage */}
                      {(() => {
                        const workerApp = applications.find(a => a.applicant_wallet === job.assigned_to)
                        const offered = parseRevisionOffering(workerApp?.revisions_offered ?? null)
                        const used = workerApp?.revisions_used ?? 0
                        const isUnlimited = offered === 'unlimited'
                        const abuseThreshold = 10
                        
                        if (isUnlimited && used >= abuseThreshold) {
                          return (
                            <button
                              onClick={() => setShowRevisionDisputeModal(true)}
                              className="w-full text-center mt-4 py-2 text-sm transition-colors"
                              style={{ color: '#6F7280' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#6F7280'}
                            >
                              ⚠️ Dispute Unreasonable Revision Requests
                            </button>
                          )
                        }
                        return null
                      })()}
                    </>
                  ) : (
                    <>
                      {/* Normal delivery flow */}
                      <h3 
                        className="text-xl font-bold mb-2"
                        style={{ color: '#7C4DFF' }}
                      >
                        🎯 Time to Deliver!
                      </h3>
                      {job.assigned_at && applications.find(a => a.applicant_wallet === job.assigned_to) && (
                        <>
                          <p 
                            className="text-sm mb-2"
                            style={{ color: '#6F7280' }}
                          >
                            Expected completion: {format(
                              getExpectedCompletionDate(
                                applications.find(a => a.applicant_wallet === job.assigned_to)!.estimated_completion
                              ),
                              'MMM dd, yyyy'
                            )}
                          </p>
                          {/* Revision Counter - Worker View */}
                          <div className="mb-4 w-full max-w-md mx-auto">
                            <RevisionCounter
                              application={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
                              size="small"
                              isWorkerView={true}
                            />
                          </div>
                        </>
                      )}
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitWork}
                        className="shadow-lg"
                      >
                        📤 Submit Your Completed Work
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* 5b. Contest Entries Section (Contests Only) */}
        {job.is_contest && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <ContestSubmissionGallery
                jobId={job.id}
                isVisible={job.contest_submissions_visible ?? true}
                isPoster={isPoster}
                userWallet={publicKey?.toString()}
                tokenSymbol={project.token_symbol}
              />
            </CardContent>
          </Card>
        )}

        {/* Activity Timeline - Shows revision requests and key events */}
        {(job.status === 'assigned' || job.status === 'submitted' || job.status === 'completed' || job.status === 'disputed') && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <JobActivityTimeline 
                job={job} 
                applications={applications}
                maxEvents={10}
              />
            </CardContent>
          </Card>
        )}

        {/* Job Discussion Thread */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <JobComments jobId={job.id} projectId={params.id as string} />
          </CardContent>
        </Card>

      </main>

      {/* Assignment Confirmation Dialog */}
      <Dialog
        open={showAssignConfirm}
        onClose={() => !assigning && setShowAssignConfirm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <div className="flex items-center gap-2">
            <WarningIcon sx={{ color: '#FB923C' }} />
            <span style={{ color: '#1A1A1E' }}>Assign Job?</span>
          </div>
        </DialogTitle>
        <DialogContent>
          {selectedApplication && (
            <div className="space-y-4">
              <div>
                <p 
                  className="text-base mb-4"
                  style={{ color: '#1A1A1E' }}
                >
                  Assign this job to:
                </p>
                <div 
                  className="p-4 rounded-lg border-2"
                  style={{ borderColor: '#E8F4FF', backgroundColor: '#F8FAFF' }}
                >
                  <div 
                    className="font-mono font-semibold mb-3"
                    style={{ color: '#1A1A1E' }}
                  >
                    {formatWalletAddress(selectedApplication.applicant_wallet)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span style={{ color: '#6F7280' }}>Karma: </span>
                      <span 
                        className="font-semibold"
                        style={{ color: '#7C4DFF' }}
                      >
                        {selectedApplication.applicant_karma?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#6F7280' }}>Completed: </span>
                      <span 
                        className="font-semibold"
                        style={{ color: '#36C170' }}
                      >
                        {selectedApplication.applicant_completed_jobs || 0} jobs
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#6F7280' }}>Timeline: </span>
                      <span 
                        className="font-semibold"
                        style={{ color: '#1A1A1E' }}
                      >
                        {selectedApplication.estimated_completion}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Worker Commitment Section */}
              <div 
                className="p-4 rounded-lg border-2"
                style={{ borderColor: '#7C4DFF', backgroundColor: '#EEE7FF' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <LoopIcon sx={{ fontSize: 20, color: '#7C4DFF' }} />
                  <p 
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: '#7C4DFF' }}
                  >
                    Worker Commitment
                  </p>
                </div>
                
                <div className="space-y-2">
                  {/* Deadline Commitment */}
                  {selectedApplication.committed_completion_date && (
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#6F7280', fontSize: '13px' }}>📅 Deadline:</span>
                      <span 
                        className="font-semibold"
                        style={{ color: '#1A1A1E', fontSize: '13px' }}
                      >
                        {format(new Date(selectedApplication.committed_completion_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                  
                  {/* Revisions Offered */}
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#6F7280', fontSize: '13px' }}>🔄 Revisions offered:</span>
                    <span 
                      className="font-semibold flex items-center gap-1"
                      style={{ 
                        color: selectedApplication.revisions_offered === 'unlimited' 
                          ? '#FB923C' 
                          : '#7C4DFF',
                        fontSize: '13px'
                      }}
                    >
                      {selectedApplication.revisions_offered === 'unlimited' && (
                        <AllInclusiveIcon sx={{ fontSize: 14 }} />
                      )}
                      {selectedApplication.revisions_offered 
                        ? formatRevisionOffering(selectedApplication.revisions_offered)
                        : 'None specified'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Information about revision tracking */}
              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: '#E8F4FF' }}
              >
                <div className="flex gap-2">
                  <InfoIcon sx={{ fontSize: 20, color: '#2563EB', mt: '2px' }} />
                  <div>
                    <p 
                      className="text-sm font-semibold mb-1"
                      style={{ color: '#1A1A1E' }}
                    >
                      Revision Tracking
                    </p>
                    <p 
                      className="text-sm"
                      style={{ color: '#6F7280' }}
                    >
                      {selectedApplication.revisions_offered === 'unlimited'
                        ? 'This worker committed to unlimited revisions. You can request changes until satisfied.'
                        : selectedApplication.revisions_offered
                          ? `This worker committed to ${formatRevisionOffering(selectedApplication.revisions_offered)}. You can request changes within this limit after delivery.`
                          : 'This worker did not specify a revision commitment. Any revisions would be voluntary.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: '#FFF4E6' }}
              >
                <div className="flex gap-2">
                  <WarningIcon sx={{ fontSize: 20, color: '#FB923C', mt: '2px' }} />
                  <div>
                    <p 
                      className="text-sm font-semibold mb-1"
                      style={{ color: '#1A1A1E' }}
                    >
                      Important:
                    </p>
                    <p 
                      className="text-sm"
                      style={{ color: '#1A1A1E' }}
                    >
                      Once assigned, this worker must deliver by their committed deadline. Other applications remain as backups if the worker fails to deliver.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outline"
            onClick={() => setShowAssignConfirm(false)}
            disabled={assigning}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmAssignment}
            disabled={assigning}
            className="min-w-[120px]"
          >
            {assigning ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              'Assign'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Release Payment Confirmation Dialog */}
      <Dialog
        open={showReleaseConfirm}
        onClose={() => !releasing && setShowReleaseConfirm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <div className="flex items-center gap-2">
            <CheckCircleIcon sx={{ color: '#36C170' }} />
            <span style={{ color: '#1A1A1E' }}>Confirm Payment Release</span>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4">
            <p 
              className="text-base"
              style={{ color: '#1A1A1E' }}
            >
              You are about to release payment to the worker. This action cannot be undone.
            </p>

            {/* Payment Breakdown */}
            {job && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ mb: 1.5, fontWeight: 600 }}
                >
                  Payment Breakdown:
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Locked Amount:</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {job.escrow_amount_tokens} {project?.token_symbol || 'SOL'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Platform Fee (5%):</Typography>
                  <Typography variant="body2">
                    {(job.escrow_amount_tokens * 0.05).toFixed(2)} {project?.token_symbol || 'SOL'}
                  </Typography>
                </Box>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    pt: 1,
                    mt: 1,
                    borderTop: '1px solid rgba(0,0,0,0.1)'
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    Worker Receives:
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    sx={{ color: '#36C170' }}
                  >
                    {(job.escrow_amount_tokens * 0.95).toFixed(2)} {project?.token_symbol || 'SOL'}
                  </Typography>
                </Box>
              </Alert>
            )}

            {/* Error Display */}
            {releaseError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>Error</AlertTitle>
                {releaseError}
              </Alert>
            )}

            <div 
              className="p-4 rounded-lg border-2"
              style={{ borderColor: '#E3F8ED', backgroundColor: '#F0FDF4' }}
            >
              <h4 
                className="text-sm font-semibold mb-3"
                style={{ color: '#36C170' }}
              >
                WHAT HAPPENS NEXT:
              </h4>
              <ul className="space-y-2 text-sm" style={{ color: '#1A1A1E' }}>
                <li>✓ Worker receives payment on-chain via Solana</li>
                <li>✓ Platform fee collected automatically</li>
                <li>✓ Both parties earn completion karma</li>
                <li>✓ Application upvoters get bonus karma</li>
                <li>✓ Job marked as completed</li>
              </ul>
            </div>

            <div 
              className="p-4 rounded-lg"
              style={{ backgroundColor: '#FFF4E6' }}
            >
              <p className="text-sm" style={{ color: '#1A1A1E' }}>
                <strong>Note:</strong> Blockchain transactions cannot be reversed. Only release payment if you're satisfied with the work.
              </p>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outline"
            onClick={() => {
              setShowReleaseConfirm(false)
              setReleaseError(null)
            }}
            disabled={releasing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleReleasePayment}
            disabled={releasing}
            className="min-w-[140px]"
            style={{ backgroundColor: '#36C170' }}
          >
            {releasing ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              'Confirm Release'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Lightbox */}
      {lightboxImage && (
        <Dialog
          open={true}
          onClose={() => setLightboxImage(null)}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton
              onClick={() => setLightboxImage(null)}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: '#fff',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.8)'
                },
                zIndex: 1
              }}
            >
              <CloseIcon />
            </IconButton>
            <img
              src={lightboxImage.url}
              alt={`Deliverable ${lightboxImage.index + 1}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Job Application Modal */}
      {job && project && publicKey && (
        <JobApplicationModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          jobId={job.id}
          jobUsdValue={job.payment_amount_usd}
          tokenMint={project.token_mint}
          projectId={project.id}
          walletAddress={publicKey.toString()}
          userKarma={userKarma}
          completedJobsCount={userCompletedJobs}
          assignmentMode={job.assignment_mode}
          jobStatus={job.status}
          job={job}
          onApplicationSubmitted={() => {
            fetchJobData() // Refresh to show new application
          }}
        />
      )}

      {/* Work Submission Modal */}
      {job && publicKey && (
        <WorkSubmissionModal
          isOpen={showSubmitWorkModal}
          onClose={() => setShowSubmitWorkModal(false)}
          jobId={job.id}
          jobUsdValue={job.payment_amount_usd}
          workerWallet={publicKey.toString()}
          onWorkSubmitted={async () => {
            // Refresh data to show submission and updated status
            await fetchJobData()
            // Modal will close itself after successful submission
          }}
          escrowAmountTokens={job.escrow_amount_tokens}
          tokenSymbol={project?.token_symbol || 'SOL'}
          existingSubmission={submission ? {
            message: submission.message,
            image_urls: submission.image_urls || [],
            external_links: submission.external_links || []
          } : undefined}
        />
      )}

      {/* Edit Job Modal */}
      {job && project && publicKey && (
        <CreateJobModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          mode="edit"
          existingJob={job}
          projectId={project.id}
          tokenMint={project.token_mint}
          tokenSymbol={project.token_symbol || 'TOKEN'}
          walletAddress={publicKey.toString()}
          onJobCreated={() => {
            fetchJobData() // Refresh to show updated job
          }}
        />
      )}

      {/* Cancel Job Confirmation Dialog */}
      <Dialog
        open={showCancelConfirm}
        onClose={() => !cancelling && setShowCancelConfirm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <div className="flex items-center gap-2">
            <WarningIcon sx={{ color: '#EF4444' }} />
            <span style={{ color: '#1A1A1E' }}>Cancel Job?</span>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4">
            <p 
              className="text-base"
              style={{ color: '#1A1A1E' }}
            >
              Are you sure you want to cancel this job? <strong>This action cannot be undone.</strong>
            </p>

            <div 
              className="p-4 rounded-lg border-2"
              style={{ borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }}
            >
              <h4 
                className="text-sm font-semibold mb-3"
                style={{ color: '#EF4444' }}
              >
                CONSEQUENCES:
              </h4>
              <ul className="space-y-2 text-sm" style={{ color: '#1A1A1E' }}>
                <li>❌ You will lose <strong>-50 karma</strong></li>
                <li>💰 Payment will be returned to your wallet</li>
                <li>🚫 All applications will be invalidated</li>
                <li>⏰ Cannot repost same job for 24 hours</li>
              </ul>
            </div>

            <div 
              className="p-4 rounded-lg"
              style={{ backgroundColor: '#FFF4E6' }}
            >
              <p className="text-sm" style={{ color: '#1A1A1E' }}>
                <strong>Note:</strong> You can cancel up to 10 jobs per week. Excessive cancellations may affect your reputation.
              </p>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outline"
            onClick={() => setShowCancelConfirm(false)}
            disabled={cancelling}
          >
            Keep Job
          </Button>
          <Button
            onClick={handleCancelJob}
            disabled={cancelling}
            className="min-w-[120px]"
            style={{ 
              backgroundColor: '#EF4444', 
              color: '#fff',
              border: 'none'
            }}
          >
            {cancelling ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              'Cancel Job'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Open Dispute Modal */}
      {job && submission && publicKey && (
        <OpenDisputeModal
          isOpen={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          jobId={job.id}
          openedBy={isPoster ? 'poster' : 'worker'}
          jobKpis={job.kpis}
          submissionSummary={submission.message}
          onDisputeOpened={() => {
            fetchJobData() // Refresh to show dispute status
          }}
        />
      )}

      {/* Open Revision Dispute Modal */}
      {job && publicKey && (
        <OpenRevisionDisputeModal
          isOpen={showRevisionDisputeModal}
          onClose={() => setShowRevisionDisputeModal(false)}
          jobId={job.id}
          jobTitle={job.title}
          jobKpis={job.kpis}
          openedBy={isPoster ? 'poster' : 'worker'}
          workerApplication={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
          revisionHistory={revisionHistory}
          unansweredSince={latestRevisionRequest?.requestedAt}
          onDisputeOpened={() => {
            fetchJobData() // Refresh to show dispute status
          }}
        />
      )}

      {/* Request Revision Modal (Poster) */}
      {job && publicKey && isPoster && (
        <RequestRevisionModal
          isOpen={showRevisionModal}
          onClose={() => setShowRevisionModal(false)}
          jobId={job.id}
          jobTitle={job.title}
          posterWallet={publicKey.toString()}
          application={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
          onRevisionRequested={() => {
            setShowRevisionModal(false)
            fetchJobData() // Refresh to show updated status
            toast.success('Revision request sent! The worker has been notified.', { duration: 4000 })
          }}
        />
      )}

      {/* Submit Revision Modal (Worker) */}
      {job && publicKey && isAssignedWorker && (
        <SubmitRevisionModal
          isOpen={showSubmitRevisionModal}
          onClose={() => setShowSubmitRevisionModal(false)}
          jobId={job.id}
          jobTitle={job.title}
          workerWallet={publicKey.toString()}
          revisionRequest={latestRevisionRequest}
          application={applications.find(a => a.applicant_wallet === job.assigned_to) || null}
          onRevisionSubmitted={() => {
            setShowSubmitRevisionModal(false)
            fetchJobData() // Refresh to show updated status
          }}
        />
      )}

      {/* Reassign Job Dialog */}
      <Dialog
        open={showReassignDialog}
        onClose={() => !reassigning && setShowReassignDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '24px' }}>🔄</span>
            <span style={{ color: '#1A1A1E' }}>Reassign Job</span>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4">
            <p 
              className="text-base"
              style={{ color: '#1A1A1E' }}
            >
              The current worker hasn't delivered. Reassign this job to another applicant?
            </p>

            <div 
              className="p-4 rounded-lg border-2"
              style={{ borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }}
            >
              <h4 
                className="text-sm font-semibold mb-3"
                style={{ color: '#EF4444' }}
              >
                CONSEQUENCES:
              </h4>
              <ul className="space-y-2 text-sm" style={{ color: '#1A1A1E' }}>
                <li>❌ Current worker will receive <strong>-50 karma penalty</strong></li>
                <li>⚠️ They'll get a <strong>"Failed to Deliver"</strong> mark on their profile</li>
                <li>🔄 Job will be reassigned to selected applicant</li>
                <li>📧 Both workers will be notified</li>
              </ul>
            </div>

            {/* List of other applicants */}
            <div>
              <h4 
                className="text-sm font-semibold mb-2"
                style={{ color: '#1A1A1E' }}
              >
                SELECT NEW WORKER:
              </h4>
              <div className="space-y-2">
                {applications
                  .filter(app => app.applicant_wallet !== job?.assigned_to && !app.is_invalidated)
                  .map((app) => (
                    <div
                      key={app.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedReassignApplicant === app.applicant_wallet
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedReassignApplicant(app.applicant_wallet)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p 
                              className="text-sm font-mono font-medium"
                              style={{ color: '#1A1A1E' }}
                            >
                              {formatWalletAddress(app.applicant_wallet)}
                            </p>
                            {/* Show "Backup" badge for applications submitted after assignment */}
                            {job?.assigned_at && new Date(app.created_at) > new Date(job.assigned_at) && (
                              <Chip
                                label="Backup"
                                size="small"
                                sx={{
                                  backgroundColor: '#FFF4E6',
                                  color: '#FB923C',
                                  fontWeight: 600,
                                  fontSize: '10px',
                                  height: '18px',
                                  border: '1px solid #FB923C'
                                }}
                              />
                            )}
                          </div>
                          <p className="text-xs" style={{ color: '#6F7280' }}>
                            {app.applicant_karma.toLocaleString()} karma • {app.applicant_completed_jobs} jobs completed
                            {app.revisions_offered && (
                              <> • <span style={{ color: app.revisions_offered === 'unlimited' ? '#FB923C' : '#7C4DFF' }}>
                                {formatRevisionOffering(app.revisions_offered)}
                              </span></>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: '#7C4DFF' }}>
                            Est: {app.estimated_completion}
                          </p>
                        </div>
                        {selectedReassignApplicant === app.applicant_wallet && (
                          <CheckCircleIcon sx={{ color: '#7C4DFF', fontSize: 24 }} />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outline"
            onClick={() => setShowReassignDialog(false)}
            disabled={reassigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReassign}
            disabled={reassigning || !selectedReassignApplicant}
            className="min-w-[120px]"
            style={{ 
              backgroundColor: '#FB923C', 
              color: '#fff',
              border: 'none'
            }}
          >
            {reassigning ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              'Reassign Job'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tip Modal */}
      {project && (
        <TipModal
          open={tipModalOpen}
          onClose={() => setTipModalOpen(false)}
          recipientWallet={tipRecipient}
          projectId={project.id}
          tokenMint={project.token_mint}
        />
      )}

      {/* Contest Submission Modal */}
      {job.is_contest && publicKey && (
        <ContestSubmissionModal
          open={contestSubmissionModalOpen}
          onClose={() => setContestSubmissionModalOpen(false)}
          job={job}
          userWallet={publicKey.toString()}
          onSubmissionSuccess={() => {
            setHasSubmittedToContest(true)
            setContestSubmissionCount(prev => prev + 1)
            fetchJobData()
          }}
        />
      )}

      {/* Winner Selection and Payout Modals (Poster Only) */}
      {job.is_contest && isPoster && contestSubmissions.length > 0 && (
        <>
          <WinnerSelectionModal
            open={winnerSelectionOpen}
            onClose={() => setWinnerSelectionOpen(false)}
            job={job}
            submissions={contestSubmissions}
            onWinnersSelected={async () => {
              setWinnerSelectionOpen(false)
              
              // Refresh contest submissions to get the updated winner data
              try {
                const { data: updatedSubmissions, error } = await supabase
                  .from('job_submissions')
                  .select('*')
                  .eq('job_id', job.id)
                  .order('submitted_at', { ascending: true })
                
                if (error) {
                  console.error('Error refreshing submissions:', error)
                  toast.error('Failed to load winner data. Please refresh the page.')
                  return
                }
                
                if (updatedSubmissions) {
                  setContestSubmissions(updatedSubmissions)
                  const winners = updatedSubmissions.filter(s => s.is_selected_winner)
                  console.log('Updated winners:', winners.length, winners)
                  setSelectedWinners(winners)
                  
                  // Only open payout modal if we have winners
                  if (winners.length > 0) {
                    // Set winners for payout BEFORE opening modal to avoid timing issues
                    setWinnersForPayout(winners)
                    // Small delay to ensure state is set
                    setTimeout(() => setPayoutModalOpen(true), 100)
                  } else {
                    toast.error('No winners found. Please try again.')
                  }
                }
                
                // Also refresh job data for the header
                await fetchJobData()
              } catch (err) {
                console.error('Error in onWinnersSelected:', err)
                toast.error('An error occurred. Please refresh the page.')
              }
            }}
          />

          <ContestPayoutModal
            open={payoutModalOpen}
            onClose={() => {
              setPayoutModalOpen(false)
              setWinnersForPayout([]) // Clear payout winners when closing
            }}
            job={job}
            winners={winnersForPayout}
            onPayoutComplete={() => {
              // Reload everything to show completed state
              setPayoutModalOpen(false)
              setWinnersForPayout([])
              fetchJobData()
              toast.success('Contest completed successfully! 🎉')
            }}
          />
        </>
      )}
    </div>
  )
}

