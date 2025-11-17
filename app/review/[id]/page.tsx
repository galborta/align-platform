'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletButton } from '@/components/WalletButton'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PendingIcon from '@mui/icons-material/Pending'
import ErrorIcon from '@mui/icons-material/Error'
import TwitterIcon from '@mui/icons-material/Twitter'
import InstagramIcon from '@mui/icons-material/Instagram'
import YouTubeIcon from '@mui/icons-material/YouTube'

type Project = Database['public']['Tables']['projects']['Row']
type SocialAsset = Database['public']['Tables']['social_assets']['Row']

interface ProjectDetails extends Project {
  social_assets: SocialAsset[]
}

const platformIcons: Record<string, React.ReactNode> = {
  twitter: <TwitterIcon />,
  instagram: <InstagramIcon />,
  youtube: <YouTubeIcon />,
  tiktok: <span className="text-xl">🎵</span>,
}

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { publicKey, connected } = useWallet()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchProject(params.id as string)
    }
  }, [params.id])

  const fetchProject = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          social_assets(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      
      if (!data) {
        setError('Project not found')
        return
      }

      setProject(data as ProjectDetails)
    } catch (error) {
      console.error('Error fetching project:', error)
      setError('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = () => {
    if (!project) return null

    switch (project.status) {
      case 'pending':
        return {
          icon: <PendingIcon sx={{ fontSize: 64 }} className="text-accent-warning" />,
          title: 'Under Review',
          description: 'Your project has been submitted and is currently under review. We\'ll verify your social accounts shortly.',
          color: 'warning'
        }
      case 'live':
        return {
          icon: <CheckCircleIcon sx={{ fontSize: 64 }} className="text-accent-success" />,
          title: 'Project is Live!',
          description: 'Congratulations! Your project has been verified and is now live on the platform.',
          color: 'success'
        }
      case 'rejected':
        return {
          icon: <ErrorIcon sx={{ fontSize: 64 }} className="text-red-500" />,
          title: 'Review Required',
          description: 'Your project needs some updates before it can go live. Please check the requirements below.',
          color: 'error'
        }
      default:
        return {
          icon: <PendingIcon sx={{ fontSize: 64 }} className="text-text-muted" />,
          title: 'Draft',
          description: 'Your project is saved as a draft.',
          color: 'default'
        }
    }
  }

  const statusInfo = getStatusInfo()

  if (loading) {
    return (
      <div className="min-h-screen bg-page-bg">
        <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <h1 className="font-display text-2xl font-bold text-text-primary cursor-pointer hover:text-accent-primary transition-colors">
                  Align
                </h1>
              </Link>
              <WalletButton />
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="font-body text-text-secondary">Loading project status...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-page-bg">
        <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <h1 className="font-display text-2xl font-bold text-text-primary cursor-pointer hover:text-accent-primary transition-colors">
                  Align
                </h1>
              </Link>
              <WalletButton />
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="font-body text-text-secondary mb-4">{error}</p>
          <Button onClick={() => router.push('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <h1 className="font-display text-2xl font-bold text-text-primary cursor-pointer hover:text-accent-primary transition-colors">
                Align
              </h1>
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Status Card */}
        <Card className="p-8 mb-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {statusInfo?.icon}
            </div>
            <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
              {statusInfo?.title}
            </h1>
            <p className="font-body text-text-secondary max-w-2xl mx-auto">
              {statusInfo?.description}
            </p>
          </div>
        </Card>

        {/* Project Details */}
        <Card className="p-6 mb-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 border border-border-subtle">
              <div>
                <label className="font-body text-sm text-text-muted">Token Name</label>
                <p className="font-body text-text-primary font-medium">{project.token_name}</p>
              </div>
              <div>
                <label className="font-body text-sm text-text-muted">Symbol</label>
                <p className="font-body text-text-primary font-medium">${project.token_symbol}</p>
              </div>
              <div className="col-span-2">
                <label className="font-body text-sm text-text-muted">Token Mint</label>
                <p className="font-body text-xs text-text-secondary break-all font-mono">{project.token_mint}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Assets - Verification Status */}
        {project.social_assets && project.social_assets.length > 0 && (
          <Card className="p-6 mb-6">
            <CardHeader className="p-0 mb-6">
              <CardTitle>Social Account Verification</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4">
                {project.social_assets.map((social) => (
                  <div
                    key={social.id}
                    className="bg-white border border-border-subtle rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-accent-primary">
                          {platformIcons[social.platform] || '🌐'}
                        </div>
                        <div>
                          <p className="font-body font-medium text-text-primary">
                            @{social.handle}
                          </p>
                          <p className="font-body text-sm text-text-secondary capitalize">
                            {social.platform}
                          </p>
                        </div>
                      </div>
                      <div>
                        {social.verified ? (
                          <span className="flex items-center gap-1 text-accent-success font-medium text-sm">
                            <CheckCircleIcon fontSize="small" />
                            Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-accent-warning font-medium text-sm">
                            <PendingIcon fontSize="small" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {!social.verified && social.verification_code && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="font-body text-sm font-semibold text-amber-900 mb-1">
                          Verification Code:
                        </p>
                        <code className="font-mono text-sm bg-white px-2 py-1 rounded border border-amber-300 text-amber-900">
                          {social.verification_code}
                        </code>
                        <p className="font-body text-xs text-amber-700 mt-2">
                          Add this code to your {social.platform} bio to verify ownership
                        </p>
                        <a 
                          href={social.profile_url || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-body text-xs text-accent-primary hover:underline mt-2 inline-block"
                        >
                          Go to profile →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {project.status === 'live' && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push(`/project/${project.id}`)}
            >
              View Live Project
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/projects')}
          >
            Browse All Projects
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => router.push('/')}
          >
            Back to Home
          </Button>
        </div>
      </main>
    </div>
  )
}

