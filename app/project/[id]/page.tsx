'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletButton } from '@/components/WalletButton'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import VerifiedIcon from '@mui/icons-material/Verified'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import TwitterIcon from '@mui/icons-material/Twitter'
import InstagramIcon from '@mui/icons-material/Instagram'
import YouTubeIcon from '@mui/icons-material/YouTube'

type Project = Database['public']['Tables']['projects']['Row']
type SocialAsset = Database['public']['Tables']['social_assets']['Row']
type CreativeAsset = Database['public']['Tables']['creative_assets']['Row']
type LegalAsset = Database['public']['Tables']['legal_assets']['Row']
type TeamWallet = Database['public']['Tables']['team_wallets']['Row']

interface ProjectDetails extends Project {
  social_assets: SocialAsset[]
  creative_assets: CreativeAsset[]
  legal_assets: LegalAsset[]
  team_wallets: TeamWallet[]
}

const platformIcons: Record<string, React.ReactNode> = {
  twitter: <TwitterIcon />,
  instagram: <InstagramIcon />,
  youtube: <YouTubeIcon />,
  tiktok: <span className="text-xl">🎵</span>,
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
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
          social_assets(*),
          creative_assets(*),
          legal_assets(*),
          team_wallets(*)
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

  const getVerifiedSocialsCount = () => {
    return project?.social_assets?.filter(asset => asset.verified).length || 0
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="font-body text-text-secondary">Loading project...</p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="font-body text-text-secondary mb-4">{error}</p>
          <Button onClick={() => router.push('/projects')}>
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Sticky Header */}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/projects">
          <Button variant="ghost" className="mb-6">
            <ArrowBackIcon className="mr-2" />
            Back to Projects
          </Button>
        </Link>

        {/* Project Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          {/* Profile Image */}
          <div className="w-32 h-32 rounded-full bg-accent-primary-soft flex items-center justify-center overflow-hidden flex-shrink-0">
            {project.profile_image_url ? (
              <img
                src={project.profile_image_url}
                alt={project.token_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display text-4xl font-bold text-accent-primary">
                {project.token_symbol.charAt(0)}
              </span>
            )}
          </div>

          {/* Project Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-display text-4xl font-bold text-text-primary mb-2">
              {project.token_name}
            </h1>
            <p className="font-body text-xl text-text-secondary mb-4">
              ${project.token_symbol}
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="px-3 py-1 bg-accent-primary-soft text-accent-primary rounded-full text-sm font-medium">
                {getVerifiedSocialsCount()} Verified Accounts
              </span>
              <span className="px-3 py-1 bg-card-bg border border-border-subtle text-text-secondary rounded-full text-sm">
                Token Mint: {shortenAddress(project.token_mint)}
              </span>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Social Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Social Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {project.social_assets && project.social_assets.length > 0 ? (
                <div className="space-y-3">
                  {project.social_assets.map((social) => (
                    <div
                      key={social.id}
                      className="flex items-center justify-between p-3 bg-page-bg rounded-lg"
                    >
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
                      {social.verified && (
                        <VerifiedIcon className="text-accent-success" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-text-muted text-center py-4">
                  No social accounts added
                </p>
              )}
            </CardContent>
          </Card>

          {/* Team Wallets */}
          <Card>
            <CardHeader>
              <CardTitle>Team Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              {project.team_wallets && project.team_wallets.length > 0 ? (
                <div className="space-y-3">
                  {project.team_wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex items-center justify-between p-3 bg-page-bg rounded-lg"
                    >
                      <div>
                        <p className="font-body font-medium text-text-primary">
                          {wallet.label || 'Team Wallet'}
                        </p>
                        <p className="font-body text-sm text-text-secondary font-mono">
                          {shortenAddress(wallet.wallet_address)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-text-muted text-center py-4">
                  No team wallets added
                </p>
              )}
            </CardContent>
          </Card>

          {/* Creative Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Creative Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {project.creative_assets && project.creative_assets.length > 0 ? (
                <div className="space-y-3">
                  {project.creative_assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 bg-page-bg rounded-lg"
                    >
                      <p className="font-body font-medium text-text-primary capitalize">
                        {asset.asset_type || 'Asset'}
                      </p>
                      <p className="font-body text-sm text-text-secondary">
                        {asset.name || 'Unnamed asset'}
                      </p>
                      {asset.description && (
                        <p className="font-body text-sm text-text-muted mt-1">
                          {asset.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-text-muted text-center py-4">
                  No creative assets added
                </p>
              )}
            </CardContent>
          </Card>

          {/* Legal Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Legal Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {project.legal_assets && project.legal_assets.length > 0 ? (
                <div className="space-y-3">
                  {project.legal_assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 bg-page-bg rounded-lg"
                    >
                      <p className="font-body font-medium text-text-primary capitalize">
                        {asset.asset_type || 'Legal Asset'}
                      </p>
                      <p className="font-body text-sm text-text-secondary">
                        {asset.name || 'Unnamed asset'}
                      </p>
                      {asset.registration_id && (
                        <p className="font-body text-sm text-text-muted mt-1">
                          ID: {asset.registration_id}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-text-muted text-center py-4">
                  No legal assets added
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

