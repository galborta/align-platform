'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PostAddIcon from '@mui/icons-material/PostAdd'
import SpeedIcon from '@mui/icons-material/Speed'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

type Job = Database['public']['Tables']['jobs']['Row']
type JobFailure = Database['public']['Tables']['job_failures']['Row']

interface JobStats {
  completedAsWorker: number
  postedTotal: number
  postedCompleted: number
  successRate: number
  avgCompletionDays: number
  totalKarmaEarned: number
  failureCount: number
  assignedTotal: number
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  design: { bg: '#EEE7FF', text: '#7C4DFF' },
  marketing: { bg: '#E3F8ED', text: '#36C170' },
  development: { bg: '#E8F4FF', text: '#2563EB' },
  content: { bg: '#FFF4E6', text: '#FB923C' },
  community: { bg: '#FCE7F3', text: '#EC4899' },
  other: { bg: '#F3F4F6', text: '#6B7280' }
}

export default function ProfileJobsPage() {
  const params = useParams()
  const router = useRouter()
  const walletAddress = params.wallet as string
  
  const [loading, setLoading] = useState(true)
  const [completedAsWorker, setCompletedAsWorker] = useState<Job[]>([])
  const [postedJobs, setPostedJobs] = useState<Job[]>([])
  const [failures, setFailures] = useState<JobFailure[]>([])
  const [stats, setStats] = useState<JobStats | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'stats' | 'worker' | 'poster' | 'failures'>('stats')
  const [showFailures, setShowFailures] = useState(false)

  useEffect(() => {
    if (walletAddress) {
      fetchJobHistory()
    }
  }, [walletAddress])

  const fetchJobHistory = async () => {
    try {
      setLoading(true)

      // Fetch jobs completed as worker
      const { data: workerJobs, error: workerError } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_to', walletAddress)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (workerError) throw workerError

      // Fetch jobs posted by user
      const { data: posterJobs, error: posterError } = await supabase
        .from('jobs')
        .select('*')
        .eq('poster_wallet', walletAddress)
        .order('created_at', { ascending: false })

      if (posterError) throw posterError

      // Fetch job failures for this worker
      const { data: failureData, error: failureError } = await supabase
        .from('job_failures')
        .select('*')
        .eq('worker_wallet', walletAddress)
        .order('created_at', { ascending: false })

      if (failureError) throw failureError

      // Fetch total assigned jobs (completed + failed)
      const { data: assignedJobs, error: assignedError } = await supabase
        .from('jobs')
        .select('id')
        .eq('assigned_to', walletAddress)
        .in('status', ['completed', 'cancelled'])

      if (assignedError) throw assignedError

      setCompletedAsWorker(workerJobs || [])
      setPostedJobs(posterJobs || [])
      setFailures(failureData || [])

      // Calculate stats
      calculateStats(workerJobs || [], posterJobs || [], failureData || [], assignedJobs || [])
    } catch (err) {
      console.error('Error fetching job history:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (
    workerJobs: Job[], 
    posterJobs: Job[], 
    failureData: JobFailure[],
    assignedJobs: { id: string }[]
  ) => {
    // Jobs completed as worker
    const completedAsWorker = workerJobs.length
    const failureCount = failureData.length
    const assignedTotal = assignedJobs.length

    // Calculate success rate: completed / (completed + failures) × 100
    const successRate = assignedTotal > 0 
      ? (completedAsWorker / assignedTotal) * 100 
      : 0

    // Posted jobs stats
    const postedTotal = posterJobs.length
    const postedCompleted = posterJobs.filter(j => j.status === 'completed').length

    // Average completion time
    let totalDays = 0
    let countWithDates = 0
    
    workerJobs.forEach(job => {
      if (job.assigned_at && job.completed_at) {
        const days = differenceInDays(
          new Date(job.completed_at),
          new Date(job.assigned_at)
        )
        totalDays += days
        countWithDates++
      }
    })

    const avgCompletionDays = countWithDates > 0 ? Math.round(totalDays / countWithDates) : 0

    // Total karma earned (worker: 50 × USD per job, poster: 50 × USD per completed job)
    const workerKarma = workerJobs.reduce((sum, job) => sum + (job.payment_amount_usd * 50), 0)
    const posterKarma = posterJobs
      .filter(j => j.status === 'completed')
      .reduce((sum, job) => sum + (job.payment_amount_usd * 50), 0)
    const totalKarmaEarned = workerKarma + posterKarma

    setStats({
      completedAsWorker,
      postedTotal,
      postedCompleted,
      successRate,
      avgCompletionDays,
      totalKarmaEarned,
      failureCount,
      assignedTotal
    })
  }

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
      <AppHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowBackIcon sx={{ fontSize: 18, mr: 1 }} />
          Back
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 
              className="text-4xl font-bold"
              style={{ 
                fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
                color: '#1A1A1E'
              }}
            >
              Job History
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span 
              className="text-lg font-mono"
              style={{ color: '#6F7280' }}
            >
              {formatWalletAddress(walletAddress)}
            </span>
            <Tooltip title={copiedAddress === walletAddress ? "Copied!" : "Copy address"}>
              <IconButton
                size="small"
                onClick={() => handleCopyAddress(walletAddress)}
                sx={{ 
                  padding: '4px',
                  color: '#6F7280',
                  '&:hover': { color: '#7C4DFF' }
                }}
              >
                <ContentCopyIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-3 mb-6">
          <Button
            variant={activeView === 'stats' ? 'primary' : 'outline'}
            onClick={() => setActiveView('stats')}
          >
            📊 Stats
          </Button>
          <Button
            variant={activeView === 'worker' ? 'primary' : 'outline'}
            onClick={() => setActiveView('worker')}
          >
            👷 Completed as Worker ({completedAsWorker.length})
          </Button>
          <Button
            variant={activeView === 'poster' ? 'primary' : 'outline'}
            onClick={() => setActiveView('poster')}
          >
            📝 Posted Jobs ({postedJobs.length})
          </Button>
        </div>

        {/* Stats View */}
        {activeView === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Completed as Worker */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#EEE7FF' }}
                  >
                    <WorkOutlineIcon sx={{ fontSize: 28, color: '#7C4DFF' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      Jobs Completed as Worker
                    </p>
                    <p 
                      className="text-3xl font-bold"
                      style={{ color: '#1A1A1E' }}
                    >
                      {stats.completedAsWorker}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Posted Jobs */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#E8F4FF' }}
                  >
                    <PostAddIcon sx={{ fontSize: 28, color: '#2563EB' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      Jobs Posted
                    </p>
                    <p 
                      className="text-3xl font-bold"
                      style={{ color: '#1A1A1E' }}
                    >
                      {stats.postedTotal}
                    </p>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      {stats.postedCompleted} completed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Success Rate */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#E3F8ED' }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 28, color: '#36C170' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      Success Rate
                    </p>
                    <p 
                      className="text-3xl font-bold"
                      style={{ color: '#1A1A1E' }}
                    >
                      {stats.successRate.toFixed(0)}%
                    </p>
                    <p className="text-xs" style={{ color: '#6F7280' }}>
                      {stats.completedAsWorker} completed / {stats.assignedTotal} assigned
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Failed Deliveries */}
            {stats.failureCount > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: stats.failureCount > 3 ? '#FEE2E2' : '#FFF4E6' }}
                    >
                      <ErrorOutlineIcon 
                        sx={{ 
                          fontSize: 28, 
                          color: stats.failureCount > 3 ? '#EF4444' : '#FB923C' 
                        }} 
                      />
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: '#6F7280' }}>
                        Failed to Deliver
                      </p>
                      <p 
                        className="text-3xl font-bold"
                        style={{ 
                          color: stats.failureCount > 3 ? '#EF4444' : '#FB923C' 
                        }}
                      >
                        {stats.failureCount}
                      </p>
                      {stats.failureCount > 3 && (
                        <div className="flex items-center gap-1 mt-1">
                          <WarningIcon sx={{ fontSize: 14, color: '#EF4444' }} />
                          <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>
                            Multiple failed deliveries
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {failures.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowFailures(!showFailures)}
                        className="text-sm font-medium hover:underline flex items-center gap-1"
                        style={{ color: '#7C4DFF' }}
                      >
                        {showFailures ? 'Hide' : 'Show'} failed jobs
                        <ExpandMoreIcon 
                          sx={{ 
                            fontSize: 18,
                            transform: showFailures ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s'
                          }} 
                        />
                      </button>
                      {showFailures && (
                        <div className="mt-3 space-y-2">
                          {failures.map((failure) => (
                            <div
                              key={failure.id}
                              className="p-3 rounded-lg border"
                              style={{ 
                                backgroundColor: '#FEF2F2',
                                borderColor: '#FEE2E2'
                              }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <Chip
                                  label={failure.failure_type.replace('_', ' ')}
                                  size="small"
                                  sx={{
                                    backgroundColor: '#EF4444',
                                    color: '#fff',
                                    fontWeight: 500,
                                    fontSize: '11px',
                                    textTransform: 'capitalize'
                                  }}
                                />
                                <p className="text-xs" style={{ color: '#6F7280' }}>
                                  {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              <p className="text-xs" style={{ color: '#6F7280' }}>
                                Job ID: {failure.job_id.slice(0, 8)}...
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Average Completion Time */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#FFF4E6' }}
                  >
                    <SpeedIcon sx={{ fontSize: 28, color: '#FB923C' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      Avg Completion Time
                    </p>
                    <p 
                      className="text-3xl font-bold"
                      style={{ color: '#1A1A1E' }}
                    >
                      {stats.avgCompletionDays}
                    </p>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Karma Earned */}
            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#FFF4E6' }}
                  >
                    <EmojiEventsIcon sx={{ fontSize: 28, color: '#FFC857' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#6F7280' }}>
                      Total Karma Earned from Jobs
                    </p>
                    <p 
                      className="text-3xl font-bold"
                      style={{ color: '#FFC857' }}
                    >
                      +{stats.totalKarmaEarned.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completed as Worker View */}
        {activeView === 'worker' && (
          <div>
            {completedAsWorker.length === 0 ? (
              <Card>
                <CardContent className="py-20">
                  <div className="text-center flex flex-col items-center">
                    <WorkOutlineIcon 
                      sx={{ fontSize: 80, color: '#A3A7B5', mb: 2 }} 
                    />
                    <h3 
                      className="text-xl font-semibold mb-2"
                      style={{ color: '#6F7280' }}
                    >
                      No completed jobs yet
                    </h3>
                    <p style={{ color: '#A3A7B5' }}>
                      This user hasn't completed any jobs as a worker
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedAsWorker.map((job) => (
                  <Card 
                    key={job.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
                    onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
                  >
                    <CardContent className="p-6">
                      {/* Category Badge */}
                      <div className="flex justify-end mb-3">
                        <Chip
                          label={job.category}
                          size="small"
                          sx={{
                            backgroundColor: categoryColors[job.category]?.bg || '#F3F4F6',
                            color: categoryColors[job.category]?.text || '#6B7280',
                            fontWeight: 500,
                            fontSize: '12px',
                            textTransform: 'capitalize'
                          }}
                        />
                      </div>

                      {/* Title */}
                      <h3 
                        className="font-bold text-lg mb-4 line-clamp-2"
                        style={{ 
                          color: '#1A1A1E',
                          minHeight: '3.5rem'
                        }}
                      >
                        {job.title}
                      </h3>

                      {/* Payment */}
                      <div className="mb-4">
                        <p 
                          className="text-xl font-bold"
                          style={{ color: '#36C170' }}
                        >
                          ${job.payment_amount_usd.toLocaleString()} USD
                        </p>
                        <p className="text-sm" style={{ color: '#6F7280' }}>
                          Earned +{(job.payment_amount_usd * 50).toLocaleString()} karma
                        </p>
                      </div>

                      {/* Completion Info */}
                      <div className="pt-3 border-t" style={{ borderColor: '#E5E7F0' }}>
                        <p className="text-sm mb-1" style={{ color: '#A3A7B5' }}>
                          Completed {job.completed_at && formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
                        </p>
                        {job.assigned_at && job.completed_at && (
                          <p className="text-sm font-medium" style={{ color: '#36C170' }}>
                            ✓ Done in {differenceInDays(new Date(job.completed_at), new Date(job.assigned_at))} days
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Posted Jobs View */}
        {activeView === 'poster' && (
          <div>
            {postedJobs.length === 0 ? (
              <Card>
                <CardContent className="py-20">
                  <div className="text-center flex flex-col items-center">
                    <PostAddIcon 
                      sx={{ fontSize: 80, color: '#A3A7B5', mb: 2 }} 
                    />
                    <h3 
                      className="text-xl font-semibold mb-2"
                      style={{ color: '#6F7280' }}
                    >
                      No posted jobs yet
                    </h3>
                    <p style={{ color: '#A3A7B5' }}>
                      This user hasn't posted any jobs
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {postedJobs.map((job) => (
                  <Card 
                    key={job.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
                    onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
                  >
                    <CardContent className="p-6">
                      {/* Status & Category */}
                      <div className="flex items-center justify-between mb-3">
                        <Chip
                          label={job.status}
                          size="small"
                          sx={{
                            backgroundColor: job.status === 'completed' ? '#E3F8ED' : '#F3F4F6',
                            color: job.status === 'completed' ? '#36C170' : '#6B7280',
                            fontWeight: 500,
                            fontSize: '12px',
                            textTransform: 'capitalize'
                          }}
                        />
                        <Chip
                          label={job.category}
                          size="small"
                          sx={{
                            backgroundColor: categoryColors[job.category]?.bg || '#F3F4F6',
                            color: categoryColors[job.category]?.text || '#6B7280',
                            fontWeight: 500,
                            fontSize: '12px',
                            textTransform: 'capitalize'
                          }}
                        />
                      </div>

                      {/* Title */}
                      <h3 
                        className="font-bold text-lg mb-4 line-clamp-2"
                        style={{ 
                          color: '#1A1A1E',
                          minHeight: '3.5rem'
                        }}
                      >
                        {job.title}
                      </h3>

                      {/* Payment */}
                      <div className="mb-4">
                        <p 
                          className="text-xl font-bold"
                          style={{ color: '#7C4DFF' }}
                        >
                          ${job.payment_amount_usd.toLocaleString()} USD
                        </p>
                        {job.status === 'completed' && (
                          <p className="text-sm" style={{ color: '#6F7280' }}>
                            Earned +{(job.payment_amount_usd * 50).toLocaleString()} karma
                          </p>
                        )}
                      </div>

                      {/* Posted Time */}
                      <div className="pt-3 border-t" style={{ borderColor: '#E5E7F0' }}>
                        <p className="text-sm" style={{ color: '#A3A7B5' }}>
                          Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </p>
                        {job.status === 'completed' && job.completed_at && (
                          <p className="text-sm font-medium" style={{ color: '#36C170' }}>
                            ✓ Completed {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

