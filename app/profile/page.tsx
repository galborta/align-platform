'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  Card,
  CardContent,
  Button,
  CircularProgress,
  Avatar,
  Typography,
  Box,
  Chip,
  IconButton,
  Paper,
  Grid,
  Divider
} from '@mui/material'
import {
  Settings as SettingsIcon,
  ArrowBack as ArrowBackIcon,
  Star as StarIcon,
  Circle as CircleIcon
} from '@mui/icons-material'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { getOrCreateProfile } from '@/lib/messaging'
import { Database } from '@/types/database'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface ProjectKarma {
  project_id: string
  project_name: string
  total_karma_points: number
}

interface JobStats {
  poster: {
    jobsPosted: number
    completedJobs: number
    disputedJobs: number
    winRate: number
  }
  worker: {
    jobsCompleted: number
    failures: number
    winRate: number
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const wallet = useWallet()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [topProjects, setTopProjects] = useState<ProjectKarma[]>([])
  const [jobStats, setJobStats] = useState<JobStats | null>(null)
  const [completedJobs, setCompletedJobs] = useState<any[]>([])
  const [showAllJobs, setShowAllJobs] = useState(false)

  const getReputationBadge = (stats: { jobsCompleted: number; failures: number }) => {
    const total = stats.jobsCompleted + stats.failures
    if (total === 0) return null
    
    const completionRate = stats.jobsCompleted / total
    
    if (completionRate >= 0.9 && stats.jobsCompleted >= 5) {
      return (
        <Chip 
          label="🟢 Trusted" 
          size="small"
          sx={{ bgcolor: '#E3F8ED', color: '#36C170', fontWeight: 600 }}
        />
      )
    } else if (completionRate >= 0.7) {
      return (
        <Chip 
          label="🟡 Reliable" 
          size="small"
          sx={{ bgcolor: '#FFF8E1', color: '#FFC857', fontWeight: 600 }}
        />
      )
    } else {
      return (
        <Chip 
          label="🔴 Risky" 
          size="small"
          sx={{ bgcolor: '#FFEBEE', color: '#E74C3C', fontWeight: 600 }}
        />
      )
    }
  }

  useEffect(() => {
    const loadProfile = async () => {
      if (!wallet?.publicKey) {
        setLoading(false)
        return
      }
      
      try {
        const prof = await getOrCreateProfile(wallet.publicKey.toString())
        setProfile(prof)

        // Load top projects
        const { data: allKarma } = await supabase
          .from('wallet_karma')
          .select(`
            wallet_address,
            project_id,
            total_karma_points,
            projects (
              id,
              name
            )
          `)
          .eq('wallet_address', wallet.publicKey.toString())
          .eq('is_banned', false)
          .order('total_karma_points', { ascending: false })
          .limit(3)
        
        if (allKarma) {
          const formatted: ProjectKarma[] = allKarma
            .filter(k => k.projects)
            .map(k => ({
              project_id: k.project_id,
              project_name: (k.projects as any)?.name || 'Unknown Project',
              total_karma_points: k.total_karma_points
            }))
          
          setTopProjects(formatted)
        }

        // Load job stats
        const { data: postedJobs } = await supabase
          .from('jobs')
          .select('*')
          .eq('poster_wallet', wallet.publicKey.toString())

        const completedPosted = postedJobs?.filter(j => j.status === 'completed').length || 0
        const disputedPosted = postedJobs?.filter(j => j.status === 'disputed').length || 0
        
        const { data: workerJobs } = await supabase
          .from('jobs')
          .select('*')
          .eq('assigned_to', wallet.publicKey.toString())
          .eq('status', 'completed')

        const completedWorker = workerJobs?.length || 0
        
        const { data: failures } = await supabase
          .from('job_failures')
          .select('*')
          .eq('worker_wallet', wallet.publicKey.toString())

        const posterWinRate = disputedPosted > 0 
          ? Math.round((completedPosted / (completedPosted + disputedPosted)) * 100) 
          : 100

        setJobStats({
          poster: {
            jobsPosted: postedJobs?.length || 0,
            completedJobs: completedPosted,
            disputedJobs: disputedPosted,
            winRate: posterWinRate
          },
          worker: {
            jobsCompleted: completedWorker,
            failures: failures?.length || 0,
            winRate: 95
          }
        })

        if (workerJobs) {
          setCompletedJobs(workerJobs)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    
    loadProfile()
  }, [wallet?.publicKey])

  const truncateWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (!wallet?.publicKey) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
        <AppHeader />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Typography variant="h6" align="center">
            Please connect your wallet to view your profile
          </Typography>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
        <AppHeader />
        <main className="max-w-4xl mx-auto px-4 py-8">
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
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header with Settings Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <IconButton onClick={() => router.push('/')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <h1 className="text-3xl font-bold">My Profile</h1>
          </div>
          
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => router.push('/profile/settings')}
            sx={{
              borderColor: '#7C4DFF',
              color: '#7C4DFF',
              '&:hover': {
                borderColor: '#7C4DFF',
                backgroundColor: 'rgba(124, 77, 255, 0.08)'
              }
            }}
          >
            Settings
          </Button>
        </div>

        {/* Profile Card */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={profile?.avatar_url || undefined}
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: '#7C4DFF',
                    fontSize: '2rem'
                  }}
                >
                  {profile?.display_name?.[0]?.toUpperCase() || 
                   wallet.publicKey.toString()[0].toUpperCase()}
                </Avatar>
                {/* Online Status Indicator */}
                <CircleIcon
                  sx={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    fontSize: 20,
                    color: '#36C170',
                    bgcolor: 'white',
                    borderRadius: '50%',
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 }
                    }
                  }}
                />
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, fontFamily: 'var(--font-heading)' }}>
                  {profile?.display_name || 'Anonymous User'}
                </Typography>
                <Chip
                  label={truncateWallet(wallet.publicKey.toString())}
                  sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    bgcolor: '#F7F8FB'
                  }}
                />
              </Box>
            </Box>

            {profile?.bio && (
              <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #E5E7F0' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                  Bio
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#1A1A1E' }}>
                  {profile.bio}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Job Stats Section */}
        {jobStats && (jobStats.poster.jobsPosted > 0 || jobStats.worker.jobsCompleted > 0) && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: '#FAFBFC', borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#1A1A1E' }}>
              Job Activity
            </Typography>

            {/* As Poster */}
            {jobStats.poster.jobsPosted > 0 && (
              <Box sx={{ mb: jobStats.worker.jobsCompleted > 0 ? 3 : 0 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: '#7C4DFF', fontWeight: 600 }}>
                  As Job Poster
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                        {jobStats.poster.jobsPosted}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Jobs Posted
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#36C170' }}>
                        {jobStats.poster.completedJobs}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Completed
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#FFC857' }}>
                        {jobStats.poster.disputedJobs}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Disputed
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                        {jobStats.poster.winRate}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Win Rate
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Divider between sections */}
            {jobStats.poster.jobsPosted > 0 && jobStats.worker.jobsCompleted > 0 && (
              <Divider sx={{ my: 3 }} />
            )}

            {/* As Worker */}
            {jobStats.worker.jobsCompleted > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, color: '#7C4DFF', fontWeight: 600 }}>
                  As Worker
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                        {jobStats.worker.jobsCompleted}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Jobs Completed
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#E74C3C' }}>
                        {jobStats.worker.failures}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Failed to Deliver
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1E' }}>
                        {jobStats.worker.winRate}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Dispute Win Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      {getReputationBadge(jobStats.worker)}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        )}

        {/* Completed Jobs Portfolio */}
        {jobStats && jobStats.worker.jobsCompleted > 0 && completedJobs.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#1A1A1E' }}>
              Portfolio ({jobStats.worker.jobsCompleted} jobs)
            </Typography>
            
            <Grid container spacing={2}>
              {completedJobs.slice(0, showAllJobs ? completedJobs.length : 6).map(job => (
                <Grid item xs={12} sm={6} md={4} key={job.id}>
                  <Card 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderRadius: 2,
                      border: '1px solid #E5E7F0',
                      '&:hover': { 
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                        transform: 'translateY(-2px)',
                        borderColor: '#7C4DFF'
                      }
                    }}
                    onClick={() => router.push(`/project/${job.project_id}/jobs/${job.id}`)}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#1A1A1E' }}>
                      {job.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6F7280', display: 'block', mb: 1 }}>
                      {job.category} • ${job.payment_amount_usd}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#36C170' }}>
                      ✓ Completed {job.completed_at ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true }) : ''}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {jobStats.worker.jobsCompleted > 6 && !showAllJobs && (
              <Button 
                fullWidth 
                sx={{ 
                  mt: 3,
                  textTransform: 'none',
                  color: '#7C4DFF',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.08)'
                  }
                }}
                onClick={() => setShowAllJobs(true)}
              >
                View All {jobStats.worker.jobsCompleted} Jobs
              </Button>
            )}
            
            {showAllJobs && jobStats.worker.jobsCompleted > 6 && (
              <Button 
                fullWidth 
                sx={{ 
                  mt: 3,
                  textTransform: 'none',
                  color: '#7C4DFF',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.08)'
                  }
                }}
                onClick={() => setShowAllJobs(false)}
              >
                Show Less
              </Button>
            )}
          </Paper>
        )}

        {/* Top Projects */}
        {topProjects.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <StarIcon sx={{ fontSize: 24, color: '#F59E0B' }} />
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#1A1A1E' }}>
                Top Projects by Karma
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {topProjects.map((proj, index) => (
                <Box
                  key={proj.project_id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    bgcolor: index === 0 ? '#FFF8E6' : '#F7F8FB',
                    borderRadius: 2,
                    border: index === 0 ? '2px solid #F59E0B' : '1px solid #E5E7F0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateX(4px)',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
                    }
                  }}
                  onClick={() => router.push(`/project/${proj.project_id}`)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {index === 0 && (
                      <StarIcon sx={{ fontSize: 20, color: '#F59E0B' }} />
                    )}
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
                        {proj.project_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6F7280' }}>
                        Rank #{index + 1}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Chip
                    label={`${proj.total_karma_points.toFixed(0)} karma`}
                    size="small"
                    sx={{
                      bgcolor: '#7C4DFF',
                      color: 'white',
                      fontWeight: 600
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* Account Information Card */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Account Information
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Privacy Level
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {profile?.privacy_level?.replace('_', ' ') || 'Public'}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Can Message You
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {profile?.allow_messages_from?.replace('_', ' ') || 'Everyone'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Member Since
                </Typography>
                <Typography variant="body1">
                  {profile?.created_at 
                    ? new Date(profile.created_at).toLocaleDateString()
                    : 'Unknown'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

