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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import TwitterIcon from '@mui/icons-material/Twitter'
import InstagramIcon from '@mui/icons-material/Instagram'
import YouTubeIcon from '@mui/icons-material/YouTube'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

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
  twitter: <TwitterIcon sx={{ fontSize: 20 }} />,
  instagram: <InstagramIcon sx={{ fontSize: 20 }} />,
  youtube: <YouTubeIcon sx={{ fontSize: 20 }} />,
  tiktok: <span className="text-xl">🎵</span>,
}

const getPlatformUrl = (platform: string, handle: string): string => {
  // Remove @ if user included it
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle
  
  const urls: Record<string, string> = {
    twitter: `https://twitter.com/${cleanHandle}`,
    instagram: `https://instagram.com/${cleanHandle}`,
    youtube: `https://youtube.com/@${cleanHandle}`,
    tiktok: `https://tiktok.com/@${cleanHandle}`,
  }
  return urls[platform] || `https://${platform}.com/${cleanHandle}`
}

interface TokenStats {
  price: number | null
  marketCap: number | null
  topHolders: Array<{
    owner: string
    amount: number
    percentage: number
  }>
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    price: null,
    marketCap: null,
    topHolders: []
  })
  const [statsLoading, setStatsLoading] = useState(false)

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

      const projectData = data as ProjectDetails
      setProject(projectData)
      
      // Fetch token stats after project loads
      if (projectData.token_mint) {
        fetchTokenStats(projectData.token_mint)
      }
    } catch (error) {
      console.error('Error fetching project:', error)
      setError('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const fetchTokenStats = async (tokenMint: string) => {
    setStatsLoading(true)
    try {
      // Try DexScreener API for price/market cap (free, no key needed)
      let priceData: any = null
      let tokenData: any = null
      
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`)
        const dexData = await dexRes.json()
        console.log('DexScreener response:', dexData)
        
        // DexScreener returns pairs, we'll take the first one with most liquidity
        if (dexData.pairs && dexData.pairs.length > 0) {
          const mainPair = dexData.pairs[0]
          tokenData = {
            price: parseFloat(mainPair.priceUsd) || null,
            marketCap: parseFloat(mainPair.fdv) || parseFloat(mainPair.marketCap) || null
          }
        }
      } catch (e) {
        console.error('DexScreener failed:', e)
      }
      
      // Fetch top holders from Helius
      const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
      let holders: Array<{owner: string, amount: number, percentage: number}> = []
      
      console.log('Helius API Key present:', !!heliusApiKey)
      
      if (heliusApiKey) {
        try {
          const holdersUrl = `https://api.helius.xyz/v0/addresses/${tokenMint}/balances?api-key=${heliusApiKey}&limit=10`
          console.log('Fetching holders from:', holdersUrl.replace(heliusApiKey, 'API_KEY_HIDDEN'))
          
          const holdersRes = await fetch(holdersUrl)
          const holdersData = await holdersRes.json()
          
          console.log('Helius response:', holdersData)
          
          if (holdersData && Array.isArray(holdersData)) {
            holders = holdersData.map((holder: any) => ({
              owner: holder.owner || holder.address,
              amount: holder.amount || 0,
              percentage: holder.share || holder.percentage || 0
            }))
          }
        } catch (holderError) {
          console.error('Error fetching holders:', holderError)
        }
      } else {
        console.warn('NEXT_PUBLIC_HELIUS_API_KEY not found in environment')
      }
      
      setTokenStats({
        price: tokenData?.price || null,
        marketCap: tokenData?.marketCap || null,
        topHolders: holders
      })
    } catch (error) {
      console.error('Error fetching token stats:', error)
    } finally {
      setStatsLoading(false)
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
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Profile Image */}
              <div className="w-24 h-24 rounded-full bg-accent-primary-soft flex items-center justify-center overflow-hidden flex-shrink-0">
                {project.profile_image_url ? (
                  <img
                    src={project.profile_image_url}
                    alt={project.token_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-3xl font-bold text-accent-primary">
                    {project.token_symbol.charAt(0)}
                  </span>
                )}
              </div>

              {/* Project Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="font-display text-3xl font-bold text-text-primary mb-1">
                  {project.token_name}
                </h1>
                <p className="font-body text-lg text-text-secondary mb-3">
                  ${project.token_symbol}
                </p>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  {getVerifiedSocialsCount() > 0 && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-accent-primary-soft text-accent-primary rounded-full text-sm font-medium">
                      <VerifiedIcon sx={{ fontSize: 18 }} />
                      <span>{getVerifiedSocialsCount()} Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Single Page */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - IP Registry */}
          <div className="lg:col-span-2 space-y-6">
            {/* Social Assets - Compact Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Social Assets</CardTitle>
              </CardHeader>
              <CardContent>
                {project.social_assets && project.social_assets.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {project.social_assets.map((social) => (
                      <a
                        key={social.id}
                        href={getPlatformUrl(social.platform, social.handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center p-3 bg-white rounded-lg border border-border-subtle hover:border-accent-primary transition-colors relative"
                      >
                        {social.verified && (
                          <div className="absolute top-2 right-2">
                            <CheckCircleIcon sx={{ color: '#7C4DFF', fontSize: 16 }} />
                          </div>
                        )}
                        <div className="text-accent-primary mb-2">
                          {platformIcons[social.platform] || '🌐'}
                        </div>
                        <p className="font-body font-medium text-text-primary text-sm text-center truncate w-full">
                          @{social.handle}
                        </p>
                        {social.follower_tier && (
                          <p className="font-body text-xs text-text-muted">
                            {social.follower_tier}
                          </p>
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="font-body text-text-muted text-center py-4">
                    No social accounts added
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Creative Assets - Album Style */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Creative Assets</CardTitle>
              </CardHeader>
              <CardContent>
                {project.creative_assets && project.creative_assets.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {project.creative_assets.slice(0, 6).map((asset) => (
                      <div
                        key={asset.id}
                        className="relative group cursor-pointer overflow-hidden rounded-lg"
                      >
                        {asset.media_url ? (
                          <div className="aspect-square bg-subtle-bg flex items-center justify-center">
                            <img
                              src={asset.media_url}
                              alt={asset.name || 'Creative asset'}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-subtle-bg flex items-center justify-center">
                            <span className="text-3xl">🎨</span>
                          </div>
                        )}
                        {asset.name && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="font-body text-xs text-white truncate">
                              {asset.name}
                            </p>
                          </div>
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

            {/* Legal Assets - Compact List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Legal Assets</CardTitle>
              </CardHeader>
              <CardContent>
                {project.legal_assets && project.legal_assets.length > 0 ? (
                  <div className="space-y-2">
                    {project.legal_assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-subtle"
                      >
                        <div className="flex-1">
                          <p className="font-body font-medium text-text-primary text-sm capitalize">
                            {asset.asset_type || 'Legal Asset'}
                          </p>
                          <p className="font-body text-xs text-text-secondary truncate">
                            {asset.name || 'Unnamed asset'}
                          </p>
                        </div>
                        {asset.status && (
                          <span className="inline-block px-2 py-1 bg-accent-primary-soft text-accent-primary rounded text-xs font-medium ml-2">
                            {asset.status}
                          </span>
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

          {/* Right Column - Team Transparency */}
          <div className="space-y-6">
            {/* Token Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Token Stats</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="font-body text-text-muted text-center py-4 text-sm">
                    Loading stats...
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-border-subtle">
                      <span className="font-body text-sm text-text-secondary">Price</span>
                      <span className="font-body text-sm font-semibold text-text-primary">
                        {tokenStats.price ? `$${tokenStats.price.toFixed(8)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-border-subtle">
                      <span className="font-body text-sm text-text-secondary">Market Cap</span>
                      <span className="font-body text-sm font-semibold text-text-primary">
                        {tokenStats.marketCap 
                          ? tokenStats.marketCap >= 1000000 
                            ? `$${(tokenStats.marketCap / 1000000).toFixed(2)}M`
                            : tokenStats.marketCap >= 1000
                            ? `$${(tokenStats.marketCap / 1000).toFixed(2)}K`
                            : `$${tokenStats.marketCap.toFixed(2)}`
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Holders Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Holders</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="font-body text-text-muted text-center py-4 text-sm">
                    Loading holders...
                  </p>
                ) : tokenStats.topHolders.length > 0 ? (
                  <div className="space-y-2">
                    {tokenStats.topHolders.slice(0, 5).map((holder, index) => (
                      <div
                        key={holder.owner}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-subtle hover:border-accent-primary transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-body text-xs font-semibold text-accent-primary flex-shrink-0">
                            #{index + 1}
                          </span>
                          <a
                            href={`https://solscan.io/account/${holder.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-body text-xs text-text-primary font-mono hover:text-accent-primary truncate"
                          >
                            {shortenAddress(holder.owner)}
                          </a>
                        </div>
                        <span className="font-body text-xs font-medium text-text-secondary ml-2 flex-shrink-0">
                          {holder.percentage ? `${holder.percentage.toFixed(2)}%` : 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-body text-text-muted text-center py-4 text-sm">
                    {process.env.NEXT_PUBLIC_HELIUS_API_KEY 
                      ? 'No holder data available' 
                      : 'Set NEXT_PUBLIC_HELIUS_API_KEY to view holders'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Team Wallets Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Wallets</CardTitle>
              </CardHeader>
              <CardContent>
                {project.team_wallets && project.team_wallets.length > 0 ? (
                  <div className="space-y-3">
                    {project.team_wallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        className="p-3 bg-white rounded-lg border border-border-subtle"
                      >
                        <p className="font-body font-medium text-text-primary text-sm mb-1">
                          {wallet.label || 'Team Wallet'}
                        </p>
                        <p className="font-body text-xs text-text-secondary font-mono mb-2">
                          {shortenAddress(wallet.wallet_address)}
                        </p>
                        <a
                          href={`https://solscan.io/account/${wallet.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent-primary hover:text-accent-primary/80 font-body text-xs font-medium"
                        >
                          View on Solscan
                          <OpenInNewIcon sx={{ fontSize: 12 }} />
                        </a>
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
          </div>
        </div>
      </main>
    </div>
  )
}

