'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AppHeader } from '@/components/AppHeader'
import { CreateJobModal } from '@/components/CreateJobModal'
import { supabase } from '@/lib/supabase'
import { getProjectJobs, getJobsByApplicant } from '@/lib/jobs'
import { Database } from '@/types/database'
import { useWallet } from '@solana/wallet-adapter-react'
import { formatDistanceToNow } from 'date-fns'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'

type Project = Database['public']['Tables']['projects']['Row']
type Job = Database['public']['Tables']['jobs']['Row']

interface JobWithApplicationCount extends Job {
  application_count: number
  worker_completed_jobs?: number
  completion_days?: number
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

export default function ProjectJobsPage() {
  const params = useParams()
  const router = useRouter()
  const { publicKey } = useWallet()
  const [project, setProject] = useState<Project | null>(null)
  const [jobs, setJobs] = useState<JobWithApplicationCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [myApplicationJobs, setMyApplicationJobs] = useState<JobWithApplicationCount[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Advanced filter states
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priceFilter, setPriceFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [walletSearch, setWalletSearch] = useState<string>('')

  useEffect(() => {
    if (params.id) {
      fetchData(params.id as string)
    }
  }, [params.id])

  useEffect(() => {
    // Fetch user's applications when My Applications tab is selected
    if (activeTab === 3 && publicKey) {
      fetchMyApplications()
    }
  }, [activeTab, publicKey])

  const fetchMyApplications = async () => {
    if (!publicKey) return

    try {
      const applicantJobs = await getJobsByApplicant(publicKey.toString())
      
      // Get application counts for these jobs
      const jobsWithCounts = await Promise.all(
        applicantJobs.map(async (job) => {
          const { count } = await supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id)

          return {
            ...job,
            application_count: count || 0
          }
        })
      )

      setMyApplicationJobs(jobsWithCounts)
    } catch (err) {
      console.error('Error fetching my applications:', err)
    }
  }

  const enrichCompletedJobs = async (completedJobs: Job[]): Promise<JobWithApplicationCount[]> => {
    return Promise.all(
      completedJobs.map(async (job) => {
        let worker_completed_jobs = 0
        let completion_days: number | undefined

        // Get worker's completed job count
        if (job.assigned_to) {
          const { count } = await supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', job.assigned_to)
            .eq('status', 'completed')

          worker_completed_jobs = count || 0
        }

        // Calculate completion time in days
        if (job.assigned_at && job.completed_at) {
          const assignedDate = new Date(job.assigned_at)
          const completedDate = new Date(job.completed_at)
          const diffTime = Math.abs(completedDate.getTime() - assignedDate.getTime())
          completion_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        }

        // Get application count
        const { count: appCount } = await supabase
          .from('job_applications')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)

        return {
          ...job,
          application_count: appCount || 0,
          worker_completed_jobs,
          completion_days
        }
      })
    )
  }

  const fetchData = async (projectId: string) => {
    try {
      setLoading(true)
      
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Fetch jobs with application counts
      const jobsData = await getProjectJobs(projectId)
      
      // Separate completed and non-completed jobs
      const completedJobs = jobsData.filter(job => job.status === 'completed')
      const otherJobs = jobsData.filter(job => job.status !== 'completed')
      
      // Get application counts for non-completed jobs
      const otherJobsWithCounts = await Promise.all(
        otherJobs.map(async (job) => {
          const { count } = await supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id)

          return {
            ...job,
            application_count: count || 0
          }
        })
      )

      // Enrich completed jobs with worker stats and completion time
      const enrichedCompletedJobs = await enrichCompletedJobs(completedJobs)

      setJobs([...otherJobsWithCounts, ...enrichedCompletedJobs])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return '🟢'
      case 'assigned': return '🟡'
      case 'submitted': return '🔵'
      case 'disputed': return '🔴'
      case 'completed': return '✅'
      case 'cancelled': return '❌'
      default: return ''
    }
  }

  const getFilteredJobs = () => {
    // Start with base tab filter
    let filtered: JobWithApplicationCount[] = []
    switch (activeTab) {
      case 0: // Open Jobs
        filtered = jobs.filter(job => job.status === 'open')
        break
      case 1: // Assigned
        filtered = jobs.filter(job => job.status === 'assigned' || job.status === 'submitted')
        break
      case 2: // Completed
        filtered = jobs.filter(job => job.status === 'completed')
        break
      case 3: // My Applications
        filtered = myApplicationJobs
        break
      default:
        filtered = jobs
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter)
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(job => job.category === categoryFilter)
    }

    // Apply price filter
    if (priceFilter !== 'all') {
      const [minStr, maxStr] = priceFilter.split('-')
      const min = parseInt(minStr)
      const max = maxStr === '+' ? Infinity : parseInt(maxStr)
      filtered = filtered.filter(job => 
        job.payment_amount_usd >= min && job.payment_amount_usd <= max
      )
    }

    // Apply wallet search
    if (walletSearch.trim()) {
      const searchLower = walletSearch.toLowerCase().trim()
      filtered = filtered.filter(job => 
        job.poster_wallet.toLowerCase().includes(searchLower) ||
        (job.assigned_to && job.assigned_to.toLowerCase().includes(searchLower))
      )
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered = filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
      case 'highest_payment':
        filtered = filtered.sort((a, b) => 
          b.payment_amount_usd - a.payment_amount_usd
        )
        break
      case 'most_applications':
        filtered = filtered.sort((a, b) => 
          b.application_count - a.application_count
        )
        break
      case 'ending_soon':
        // For disputed jobs, sort by how soon they end
        filtered = filtered
          .filter(job => job.status === 'disputed')
          .sort((a, b) => {
            if (!a.submitted_at || !b.submitted_at) return 0
            return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
          })
        break
    }

    return filtered
  }

  const filteredJobs = getFilteredJobs()

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E3F06F' }}>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-20">
            <CircularProgress sx={{ color: '#7C4DFF' }} />
          </div>
        </main>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E3F06F' }}>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent>
              <p className="text-red-600">{error || 'Project not found'}</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E3F06F' }}>
      <AppHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 
              className="text-4xl font-bold mb-2"
              style={{ 
                fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
                color: '#1A1A1E'
              }}
            >
              Jobs & Bounties
            </h1>
            <p className="text-lg" style={{ color: '#6F7280' }}>
              Commission work from the community. Pay in {project.token_symbol}.
            </p>
          </div>
          
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowCreateModal(true)}
            className="shadow-lg"
          >
            Post Work
          </Button>
        </div>

        {/* Tabs Navigation & Content */}
        <Card>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 500,
                color: '#6F7280',
                '&.Mui-selected': {
                  color: '#7C4DFF',
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#7C4DFF',
              },
              borderBottom: '1px solid #E5E7F0'
            }}
          >
            <Tab label="Open Jobs" />
            <Tab label="Assigned" />
            <Tab label="Completed" />
            <Tab label="My Applications" />
          </Tabs>

          {/* Advanced Filters */}
          <Box 
            sx={{ 
              p: 3, 
              borderBottom: '1px solid #E5E7F0',
              display: 'flex', 
              gap: 2, 
              flexWrap: 'wrap',
              '@media (max-width: 600px)': {
                flexDirection: 'column'
              }
            }}
          >
            {/* Status Filter */}
            <FormControl 
              sx={{ 
                minWidth: 150,
                '@media (max-width: 600px)': {
                  width: '100%'
                }
              }}
            >
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="open">🟢 Open</MenuItem>
                <MenuItem value="assigned">🟡 Assigned</MenuItem>
                <MenuItem value="submitted">🔵 Submitted</MenuItem>
                <MenuItem value="disputed">🔴 Disputed</MenuItem>
                <MenuItem value="completed">✅ Completed</MenuItem>
                <MenuItem value="cancelled">❌ Cancelled</MenuItem>
              </Select>
            </FormControl>

            {/* Category Filter */}
            <FormControl 
              sx={{ 
                minWidth: 150,
                '@media (max-width: 600px)': {
                  width: '100%'
                }
              }}
            >
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="design">Design</MenuItem>
                <MenuItem value="marketing">Marketing</MenuItem>
                <MenuItem value="development">Development</MenuItem>
                <MenuItem value="content">Content</MenuItem>
                <MenuItem value="community">Community</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            {/* Price Range Filter */}
            <FormControl 
              sx={{ 
                minWidth: 150,
                '@media (max-width: 600px)': {
                  width: '100%'
                }
              }}
            >
              <InputLabel>Price Range</InputLabel>
              <Select
                value={priceFilter}
                label="Price Range"
                onChange={(e) => setPriceFilter(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="5-25">$5-25</MenuItem>
                <MenuItem value="25-100">$25-100</MenuItem>
                <MenuItem value="100-500">$100-500</MenuItem>
                <MenuItem value="500-99999">$500+</MenuItem>
              </Select>
            </FormControl>

            {/* Sort By */}
            <FormControl 
              sx={{ 
                minWidth: 150,
                '@media (max-width: 600px)': {
                  width: '100%'
                }
              }}
            >
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="highest_payment">Highest Payment</MenuItem>
                <MenuItem value="most_applications">Most Applications</MenuItem>
                <MenuItem value="ending_soon">Ending Soon (Disputes)</MenuItem>
              </Select>
            </FormControl>

            {/* Search by Wallet */}
            <TextField
              label="Search by wallet"
              value={walletSearch}
              onChange={(e) => setWalletSearch(e.target.value)}
              placeholder="7xK...9mP"
              sx={{ 
                minWidth: 200,
                bgcolor: '#fff',
                '@media (max-width: 600px)': {
                  width: '100%'
                }
              }}
              size="small"
            />
          </Box>

          {/* Content Area */}
          {filteredJobs.length === 0 ? (
            // Empty State
            <CardContent className="py-20">
              <div className="text-center flex flex-col items-center">
                <WorkOutlineIcon 
                  sx={{ fontSize: 80, color: '#A3A7B5', mb: 2 }} 
                />
                <h3 
                  className="text-2xl font-bold mb-2"
                  style={{ color: '#1A1A1E' }}
                >
                  No jobs posted yet
                </h3>
                <p className="text-lg mb-6" style={{ color: '#6F7280' }}>
                  Be the first to post work for the community
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowCreateModal(true)}
                >
                  Post Work
                </Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJobs.map((job) => (
                  <Card 
                    key={job.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
                    onClick={() => router.push(`/project/${params.id}/jobs/${job.id}`)}
                  >
                    <CardContent className="p-6">
                      {/* Status Indicator */}
                      <div className="flex items-center justify-between mb-4 mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {getStatusIcon(job.status)}
                          </span>
                          <span 
                            className="text-sm font-medium capitalize"
                            style={{ color: '#6F7280' }}
                          >
                            {job.status}
                          </span>
                        </div>
                        
                        {/* Category Badge */}
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
                          {job.payment_amount_tokens.toLocaleString()} {project.token_symbol}
                        </p>
                        <p 
                          className="text-sm"
                          style={{ color: '#6F7280' }}
                        >
                          ${job.payment_amount_usd.toLocaleString()} USD
                        </p>
                      </div>

                      {/* Application Count Chip */}
                      {job.application_count > 0 && job.status !== 'completed' && (
                        <div className="mb-3">
                          <Chip 
                            label={`${job.application_count} ${job.application_count === 1 ? 'application' : 'applications'}`}
                            size="small"
                            sx={{
                              bgcolor: '#E8F4FF',
                              color: '#2563EB',
                              fontWeight: 500,
                              fontSize: '12px'
                            }}
                          />
                        </div>
                      )}

                      {/* Completed By (for completed jobs) OR Posted By */}
                      {job.status === 'completed' && job.assigned_to ? (
                        <>
                          <div className="mb-3 flex items-center gap-2">
                            <span 
                              className="text-sm"
                              style={{ color: '#6F7280' }}
                            >
                              Completed by:
                            </span>
                            <span 
                              className="text-sm font-mono"
                              style={{ color: '#1A1A1E' }}
                            >
                              {formatWalletAddress(job.assigned_to)}
                            </span>
                            {job.worker_completed_jobs && job.worker_completed_jobs > 0 && (
                              <Chip
                                label={`Builder - ${job.worker_completed_jobs} jobs`}
                                size="small"
                                sx={{
                                  backgroundColor: '#E8F4FF',
                                  color: '#2563EB',
                                  fontWeight: 500,
                                  fontSize: '11px',
                                  height: '20px'
                                }}
                              />
                            )}
                            <Tooltip title={copiedAddress === job.assigned_to ? "Copied!" : "Copy address"}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopyAddress(job.assigned_to!)
                                }}
                                sx={{ 
                                  padding: '2px',
                                  color: '#6F7280',
                                  '&:hover': { color: '#7C4DFF' }
                                }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </div>
                          <div className="mb-3 flex items-center gap-2">
                            <span 
                              className="text-sm"
                              style={{ color: '#6F7280' }}
                            >
                              Poster:
                            </span>
                            <span 
                              className="text-sm font-mono"
                              style={{ color: '#1A1A1E' }}
                            >
                              {formatWalletAddress(job.poster_wallet)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="mb-3 flex items-center gap-2">
                          <span 
                            className="text-sm"
                            style={{ color: '#6F7280' }}
                          >
                            Posted by:
                          </span>
                          <span 
                            className="text-sm font-mono"
                            style={{ color: '#1A1A1E' }}
                          >
                            {formatWalletAddress(job.poster_wallet)}
                          </span>
                          <Tooltip title={copiedAddress === job.poster_wallet ? "Copied!" : "Copy address"}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyAddress(job.poster_wallet)
                            }}
                            sx={{ 
                              padding: '2px',
                              color: '#6F7280',
                              '&:hover': { color: '#7C4DFF' }
                            }}
                          >
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </div>
                      )}

                      {/* Posted Time & Applications OR Completed Info */}
                      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#E5E7F0' }}>
                        {job.status === 'completed' && job.completed_at ? (
                          <>
                            <div className="flex flex-col gap-1">
                              <span 
                                className="text-sm"
                                style={{ color: '#A3A7B5' }}
                              >
                                Completed {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
                              </span>
                              {job.completion_days && (
                                <span 
                                  className="text-sm font-medium"
                                  style={{ color: '#36C170' }}
                                >
                                  ✓ Completed in {job.completion_days} day{job.completion_days > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <span 
                              className="text-sm"
                              style={{ color: '#A3A7B5' }}
                            >
                              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </span>
                            <span 
                              className="text-sm font-medium"
                              style={{ color: '#7C4DFF' }}
                            >
                              {job.application_count} {job.application_count === 1 ? 'application' : 'applications'}
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </main>

      {/* Create Job Modal */}
      {project && publicKey && (
        <CreateJobModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={project.id}
          tokenMint={project.token_mint}
          tokenSymbol={project.token_symbol}
          walletAddress={publicKey.toString()}
          onJobCreated={() => {
            // Refresh jobs list
            fetchData(params.id as string)
          }}
        />
      )}
    </div>
  )
}
