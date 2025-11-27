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
import { supabase } from '@/lib/supabase'
import { getJobById } from '@/lib/jobs'
import { upvoteApplication, getApplicationVotes, hasUserVoted } from '@/lib/job-upvoting'
import { awardApplicationUpvoterBonuses } from '@/lib/job-karma'
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
import Tooltip from '@mui/material/Tooltip'
import SearchIcon from '@mui/icons-material/Search'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import LockIcon from '@mui/icons-material/Lock'
import WorkIcon from '@mui/icons-material/Work'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import CloseIcon from '@mui/icons-material/Close'
import GavelIcon from '@mui/icons-material/Gavel'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
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
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

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
  const [releasing, setReleasing] = useState(false)
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
  const [sortBy, setSortBy] = useState<'votes' | 'karma' | 'recent'>('votes')

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

      // Fetch submission if job is submitted, completed, or disputed
      if (jobData.status === 'submitted' || jobData.status === 'completed' || jobData.status === 'disputed') {
        const { data: submissionData, error: submissionError } = await supabase
          .from('job_submissions')
          .select('*')
          .eq('job_id', params.jobId as string)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (submissionError) {
          console.error('Error fetching submission:', submissionError)
        } else {
          setSubmission(submissionData)
        }
      }

      // Fetch dispute if job is disputed
      if (jobData.status === 'disputed') {
        await fetchDisputeData(params.jobId as string, jobData.project_id)
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
      // Check cancellation limit (max 10 per week)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { count: cancellationCount, error: countError } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('poster_wallet', publicKey.toString())
        .eq('status', 'cancelled')
        .gte('cancelled_at', sevenDaysAgo.toISOString())

      if (countError) throw countError

      if (cancellationCount && cancellationCount >= 10) {
        toast.error("You've cancelled 10 jobs this week. Try again next week.")
        setShowCancelConfirm(false)
        setCancelling(false)
        return
      }

      // Cancel the job
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (updateError) throw updateError

      // Invalidate all applications
      const { error: invalidateError } = await supabase
        .from('job_applications')
        .update({
          is_invalidated: true,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.id)
        .eq('is_invalidated', false)

      if (invalidateError) throw invalidateError

      // TODO: Apply karma penalty (-50 × tier multiplier)
      // TODO: Return tokens from escrow (Phase 2)
      // TODO: Send notifications to applicants

      toast.success('Job cancelled. -50 karma penalty applied', {
        duration: 4000,
        icon: '🚫'
      })

      setShowCancelConfirm(false)

      // Refresh job data
      await fetchJobData()
    } catch (err) {
      console.error('Error cancelling job:', err)
      toast.error('Failed to cancel job')
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
    if (!selectedApplication || !job) return

    setAssigning(true)
    try {
      // Update job with assignment and set hard deadline from worker's commitment
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_to: selectedApplication.applicant_wallet,
          assigned_at: new Date().toISOString(),
          hard_deadline: selectedApplication.committed_completion_date, // Set binding deadline
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (updateError) throw updateError

      toast.success(`Job assigned to ${formatWalletAddress(selectedApplication.applicant_wallet)}! 🎉`)
      setShowAssignConfirm(false)
      setSelectedApplication(null)
      
      // Refresh job data
      await fetchJobData()
    } catch (err) {
      console.error('Error assigning job:', err)
      toast.error('Failed to assign job')
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
    if (!job) return

    setReleasing(true)
    try {
      // Update job status to 'completed'
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (updateError) throw updateError

      // TODO: Award karma to both parties
      // const completionKarma = calculateJobCompletionKarma(job.payment_amount_usd)
      // await awardJobCompletionKarma(job.poster_wallet, job.assigned_to, job.project_id, completionKarma)

      // Award upvoter bonuses
      await awardApplicationUpvoterBonuses(job.id, job.payment_amount_usd)

      toast.success('🎉 Payment released! Karma awarded to all parties', {
        duration: 5000,
        style: {
          background: '#36C170',
          color: '#fff',
        }
      })

      setShowReleaseConfirm(false)
      
      // Refresh job data
      await fetchJobData()
    } catch (err) {
      console.error('Error releasing payment:', err)
      toast.error('Failed to release payment')
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
    if (!selectedReassignApplicant || !job) {
      toast.error('Please select an applicant')
      return
    }

    setReassigning(true)

    try {
      // Create job failure record
      const { error: failureError } = await supabase
        .from('job_failures')
        .insert({
          job_id: job.id,
          worker_wallet: job.assigned_to!,
          failure_type: 'reassigned'
        })

      if (failureError) throw failureError

      // TODO: Apply karma penalty to current worker (-50 × tier multiplier)
      // await penalizeKarma(job.assigned_to!, job.project_id, -50 * tierMultiplier)

      // Update job assignment
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          assigned_to: selectedReassignApplicant,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (updateError) throw updateError

      // TODO: Notify both workers (Sprint 2.3)
      // await notifyReassignment(job.id, job.assigned_to!, selectedReassignApplicant)

      toast.success('Job reassigned. Previous worker penalized.', {
        duration: 4000,
        icon: '🔄'
      })

      setShowReassignDialog(false)
      setSelectedReassignApplicant(null)

      // Refresh job data
      await fetchJobData()
    } catch (err) {
      console.error('Error reassigning job:', err)
      toast.error('Failed to reassign job')
    } finally {
      setReassigning(false)
    }
  }

  const truncateUrl = (url: string, maxLength: number = 40): string => {
    if (url.length <= maxLength) return url
    return url.slice(0, maxLength) + '...'
  }

  const getSortedApplications = () => {
    // Combine applications with their vote data
    const appsWithVotes = applications.map(app => ({
      ...app,
      votes: applicationVotes[app.id] || { totalWeight: 0, voterCount: 0, hasVoted: false }
    }))

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
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      
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
  // Allow applications to open OR assigned jobs (as backup applicants)
  const canApply = (job.status === 'open' || job.status === 'assigned') && publicKey && !isPoster

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

        {/* Completion Banner (for completed jobs) */}
        {job.status === 'completed' && job.completed_at && (
          <Card className="mb-6" style={{ borderColor: '#36C170', borderWidth: '2px' }}>
            <CardContent className="p-6" style={{ backgroundColor: '#F0FDF4' }}>
              <div className="flex items-start gap-4">
                <CheckCircleIcon sx={{ fontSize: 48, color: '#36C170' }} />
                <div className="flex-1">
                  <h2 
                    className="text-2xl font-bold mb-4"
                    style={{ color: '#1A1A1E' }}
                  >
                    ✅ Completed on {format(new Date(job.completed_at), 'MMMM dd, yyyy')}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Worker Karma */}
                    {job.assigned_to && (
                      <div 
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: '#DCFCE7' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold" style={{ color: '#166534' }}>
                            WORKER
                          </span>
                        </div>
                         <div className="flex items-center gap-2">
                           <span 
                             className="text-sm font-mono"
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
                                 '&:hover': { color: '#36C170' }
                               }}
                             >
                               <ContentCopyIcon sx={{ fontSize: 14 }} />
                             </IconButton>
                           </Tooltip>
                           {renderMessageTipButtons(job.assigned_to)}
                         </div>
                        <p className="text-sm font-bold mt-1" style={{ color: '#16A34A' }}>
                          Earned +{(job.payment_amount_usd * 50).toLocaleString()} karma
                        </p>
                      </div>
                    )}

                    {/* Poster Karma */}
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: '#DCFCE7' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: '#166534' }}>
                          POSTER
                        </span>
                      </div>
                       <div className="flex items-center gap-2">
                         <span 
                           className="text-sm font-mono"
                           style={{ color: '#1A1A1E' }}
                         >
                           {formatWalletAddress(job.poster_wallet)}
                         </span>
                         <Tooltip title="Copy address">
                           <IconButton
                             size="small"
                             onClick={() => handleCopyAddress(job.poster_wallet)}
                             sx={{ 
                               padding: '2px',
                               color: '#6F7280',
                               '&:hover': { color: '#36C170' }
                             }}
                           >
                             <ContentCopyIcon sx={{ fontSize: 14 }} />
                           </IconButton>
                         </Tooltip>
                         {renderMessageTipButtons(job.poster_wallet)}
                       </div>
                      <p className="text-sm font-bold mt-1" style={{ color: '#16A34A' }}>
                        Earned +{(job.payment_amount_usd * 50).toLocaleString()} karma
                      </p>
                    </div>
                  </div>

                  {/* Voter Bonus Karma Section */}
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: '#DCFCE7' }}
                  >
                    <p className="text-sm font-medium" style={{ color: '#166534' }}>
                      🏆 Bonus karma distributed to voters who upvoted the winning application
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#166534' }}>
                      Voters earned: ${job.payment_amount_usd.toFixed(0)} × 5 × tier multiplier karma
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                      className="text-sm font-mono"
                      style={{ color: '#6F7280' }}
                    >
                      {dispute.opened_by === 'poster' 
                        ? formatWalletAddress(job.poster_wallet)
                        : job.assigned_to ? formatWalletAddress(job.assigned_to) : 'N/A'
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
                     className="text-sm font-mono font-medium"
                     style={{ color: '#1A1A1E' }}
                   >
                     {formatWalletAddress(job.poster_wallet)}
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

                {/* Deadline Information */}
                {job.hard_deadline && job.status === 'assigned' && (
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mt: 3,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: getDaysUntilDeadline(job.hard_deadline) < 3 ? '#FEE' : '#F8F5FF'
                    }}
                  >
                    <CalendarTodayIcon 
                      sx={{ 
                        mr: 1.5, 
                        color: getDaysUntilDeadline(job.hard_deadline) < 3 ? '#DC2626' : '#7C4DFF',
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
                        {getDaysUntilDeadline(job.hard_deadline) < 0 ? '🚨 Deadline Passed' : '⏰ Hard Deadline'}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: getDaysUntilDeadline(job.hard_deadline) < 3 ? '#DC2626' : '#6F7280'
                        }}
                      >
                        {formatDeadline(job.hard_deadline)}
                      </Typography>
                    </Box>
                  </Box>
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

            {/* Deadline Reminder for Worker */}
            {job.status === 'assigned' && 
             job.assigned_to === publicKey?.toString() && 
             job.hard_deadline && (
              <Alert 
                severity={getDaysUntilDeadline(job.hard_deadline) < 3 ? 'error' : 'warning'}
                sx={{ 
                  mb: 3,
                  backgroundColor: getDaysUntilDeadline(job.hard_deadline) < 3 ? '#FEE' : '#FFF4E6',
                  '& .MuiAlert-icon': {
                    color: getDaysUntilDeadline(job.hard_deadline) < 3 ? '#DC2626' : '#FB923C'
                  }
                }}
              >
                <AlertTitle sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                  {getDaysUntilDeadline(job.hard_deadline) < 3 ? '🚨 Urgent Deadline' : '⏰ Deadline Reminder'}
                </AlertTitle>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>Delivery deadline:</strong> {formatDeadline(job.hard_deadline)}
                </Typography>
                <Typography variant="body2" sx={{ mb: getDaysUntilDeadline(job.hard_deadline) < 3 ? 1 : 0 }}>
                  {getDaysUntilDeadline(job.hard_deadline) > 0 
                    ? `${getDaysUntilDeadline(job.hard_deadline)} ${getDaysUntilDeadline(job.hard_deadline) === 1 ? 'day' : 'days'} remaining to submit your work`
                    : 'Deadline has passed - submit immediately to avoid penalties'}
                </Typography>
                {getDaysUntilDeadline(job.hard_deadline) < 3 && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      mt: 1, 
                      fontWeight: 600,
                      color: getDaysUntilDeadline(job.hard_deadline) < 0 ? '#DC2626' : '#1A1A1E'
                    }}
                  >
                    ⚠️ Missing this deadline without submission will result in job cancellation and karma penalties
                  </Typography>
                )}
              </Alert>
            )}

            {/* Missed Deadline Alert for Poster */}
            {job.status === 'assigned' && 
             job.poster_wallet === publicKey?.toString() &&
             job.hard_deadline &&
             getDaysUntilDeadline(job.hard_deadline) < 0 &&
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
                  The worker has not submitted work by the committed deadline ({formatDeadline(job.hard_deadline)}).
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
                    <div className="flex gap-3">
                      <Button
                        variant="contained"
                        onClick={() => setShowReleaseConfirm(true)}
                        sx={{
                          flex: 1,
                          backgroundColor: '#7C4DFF',
                          color: '#fff',
                          textTransform: 'none',
                          fontSize: '16px',
                          py: 1.5,
                          '&:hover': {
                            backgroundColor: '#6B3FEE'
                          }
                        }}
                      >
                        Release Payment
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleOpenDispute}
                        sx={{
                          flex: 1,
                          color: '#EF4444',
                          borderColor: '#EF4444',
                          textTransform: 'none',
                          fontSize: '16px',
                          py: 1.5,
                          '&:hover': {
                            borderColor: '#DC2626',
                            backgroundColor: '#FEF2F2'
                          }
                        }}
                      >
                        Open Dispute
                      </Button>
                    </div>
                  )}

                  {/* Worker View */}
                  {job.status === 'submitted' && isAssignedWorker && (
                    <div 
                      className="p-4 rounded-lg text-center"
                      style={{ backgroundColor: '#F8F5FF' }}
                    >
                      <p 
                        className="text-base font-semibold mb-2"
                        style={{ color: '#7C4DFF' }}
                      >
                        ⏳ Waiting for poster review...
                      </p>
                      <p className="text-sm" style={{ color: '#6F7280' }}>
                        Auto-releases in: {getTimeUntilAutoRelease(job.submitted_at || '')}
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

            {/* 4. Actions Section */}
            <Card>
              <CardContent className="p-6">
                <h3 
                  className="text-sm font-semibold uppercase tracking-wide mb-4"
                  style={{ color: '#6F7280' }}
                >
                  Actions
                </h3>

                {/* If job is Open/Assigned and user is NOT poster */}
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
                    {job.status === 'assigned' && (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitWork}
                        className="w-full shadow-lg"
                      >
                        Submit Work
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
          </div>
        </div>

        {/* 5. Applications Section */}
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

            {/* Sort Controls - NEW */}
            {job.status === 'open' && applications.length > 1 && (
              <div className="mb-6 flex items-center gap-3">
                <span 
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{ color: '#6F7280' }}
                >
                  SORT BY:
                </span>
                <div className="flex gap-2">
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
                          {/* Existing Pick Button */}
                          {isPoster && job.status === 'open' && job.assignment_mode === 'review' && (
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

            {/* Waiting for Submission Section (if assigned) */}
            {job.status === 'assigned' && job.assigned_to && isAssignedWorker && (
              <div 
                className="mt-6 p-6 rounded-lg border-2"
                style={{ borderColor: '#7C4DFF', backgroundColor: '#F8F5FF' }}
              >
                <div className="text-center">
                  <h3 
                    className="text-xl font-bold mb-2"
                    style={{ color: '#7C4DFF' }}
                  >
                    🎯 Time to Deliver!
                  </h3>
                  {job.assigned_at && applications.find(a => a.applicant_wallet === job.assigned_to) && (
                    <p 
                      className="text-sm mb-4"
                      style={{ color: '#6F7280' }}
                    >
                      Expected completion: {format(
                        getExpectedCompletionDate(
                          applications.find(a => a.applicant_wallet === job.assigned_to)!.estimated_completion
                        ),
                        'MMM dd, yyyy'
                      )}
                    </p>
                  )}
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSubmitWork}
                    className="shadow-lg"
                  >
                    📤 Submit Your Completed Work
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                      Other applications will remain visible but cannot be selected unless this worker fails to deliver.
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
            <span style={{ color: '#1A1A1E' }}>Release Payment?</span>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4">
            <p 
              className="text-base"
              style={{ color: '#1A1A1E' }}
            >
              Confirm that the work meets all KPIs and release payment to the worker.
            </p>

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
                <li>✓ Worker receives payment immediately</li>
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
                <strong>Note:</strong> This action cannot be undone. Only release payment if you're satisfied with the work.
              </p>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outline"
            onClick={() => setShowReleaseConfirm(false)}
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
              'Release Payment'
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
          onWorkSubmitted={() => {
            fetchJobData() // Refresh to show submission
          }}
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
    </div>
  )
}

