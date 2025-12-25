'use client'

import { useState, useEffect } from 'react'
import { Box, Typography, Link as MuiLink, Tooltip } from '@mui/material'
import Image from 'next/image'
import { 
  Twitter as TwitterIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  Language as WebIcon,
  OpenInNew as ExternalIcon,
  CheckCircle as VerifiedIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface SocialAsset {
  id: string
  platform: string
  handle: string
  profile_url: string | null
  follower_tier: string | null
  verified: boolean | null
  asset_classification: 'official' | 'affiliated'
  created_at: string | null
}

interface SocialAssetsProps {
  projectId: string
  tokenName: string
  type: 'official' | 'affiliated'  // Determine which type to display
}

// Platform icon mapping using brand logos
const getPlatformIcon = (platform: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    twitter: <Image src="/logos/xlogo.png" alt="X" width={20} height={20} className="object-contain" />,
    x: <Image src="/logos/xlogo.png" alt="X" width={20} height={20} className="object-contain" />,
    instagram: <Image src="/logos/instagram logo.png" alt="Instagram" width={20} height={20} className="object-contain" />,
    youtube: <Image src="/logos/youtubelogo.png" alt="YouTube" width={20} height={20} className="object-contain" />,
    tiktok: <Image src="/logos/tiktoklogo.png" alt="TikTok" width={20} height={20} className="object-contain" />,
    telegram: <Image src="/logos/telegramlogo.png" alt="Telegram" width={20} height={20} className="object-contain" />,
    facebook: <Image src="/logos/facebook logo.png" alt="Facebook" width={20} height={20} className="object-contain" />,
    domain: <WebIcon sx={{ fontSize: 20, color: 'var(--text-secondary)' }} />
  }
  return iconMap[platform.toLowerCase()] || <WebIcon sx={{ fontSize: 20, color: 'var(--icon-default)' }} />
}

// Get platform URL
const getPlatformUrl = (asset: SocialAsset): string => {
  if (asset.profile_url) return asset.profile_url
  
  if (asset.platform === 'domain') {
    return asset.handle.startsWith('http') ? asset.handle : `https://${asset.handle}`
  }

  const cleanHandle = asset.handle.startsWith('@') ? asset.handle.slice(1) : asset.handle

  switch (asset.platform.toLowerCase()) {
    case 'twitter':
    case 'x':
      return `https://x.com/${cleanHandle}`
    case 'instagram':
      return `https://instagram.com/${cleanHandle}`
    case 'youtube':
      return `https://youtube.com/@${cleanHandle}`
    case 'tiktok':
      return `https://tiktok.com/@${cleanHandle}`
    case 'telegram':
      return `https://t.me/${cleanHandle}`
    case 'facebook':
      return `https://facebook.com/${cleanHandle}`
    default:
      return '#'
  }
}

// Sort by follower tier (highest first)
const sortByFollowerTier = (a: SocialAsset, b: SocialAsset) => {
  const tierOrder: Record<string, number> = {
    '5m+': 7,
    '1m-5m': 6,
    '500k-1m': 5,
    '100k-500k': 4,
    '50k-100k': 3,
    '10k-50k': 2,
    '<10k': 1
  }
  
  const tierA = tierOrder[a.follower_tier || ''] || 0
  const tierB = tierOrder[b.follower_tier || ''] || 0
  
  return tierB - tierA
}

function SocialAssetsSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {[1, 2, 3].map(i => (
        <Box
          key={i}
          sx={{
            width: 120,
            height: 36,
            bgcolor: 'var(--subtle-background)',
            borderRadius: 'var(--radius-control)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Box>
  )
}

export function SocialAssets({ projectId, tokenName, type }: SocialAssetsProps) {
  const [assets, setAssets] = useState<SocialAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAssets() {
      try {
        const { data, error } = await supabase
          .from('social_assets')
          .select('*')
          .eq('project_id', projectId)
          .eq('verified', true)
          .eq('asset_classification', type)
          .order('created_at', { ascending: false })

        if (error) throw error

        setAssets(data || [])
      } catch (error) {
        console.error('Error loading social assets:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAssets()
  }, [projectId, type])

  // Separate social accounts from domains
  const socialAccounts = assets.filter(a => a.platform !== 'domain')
  const domains = assets.filter(a => a.platform === 'domain')

  // Sort affiliated by follower tier
  const sortedSocial = type === 'affiliated' 
    ? socialAccounts.sort(sortByFollowerTier)
    : socialAccounts

  if (loading) {
    return <SocialAssetsSkeleton />
  }

  // For official assets, return inline display (used under project header)
  if (type === 'official') {
    if (assets.length === 0) return null

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 } }}>
        {sortedSocial.map(asset => (
          <Tooltip
            key={asset.id}
            title={
              asset.platform === 'domain' 
                ? asset.handle 
                : `@${asset.handle}${asset.follower_tier ? ` • ${asset.follower_tier}` : ''}`
            }
            arrow
          >
            <MuiLink
              href={getPlatformUrl(asset)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.75, sm: 1 },
                px: { xs: 1.25, sm: 1.5 },
                py: { xs: 0.75, sm: 1 },
                bgcolor: 'var(--card-background)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-control)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'var(--accent-primary-soft)',
                  borderColor: 'var(--accent-primary)',
                  transform: 'translateY(-2px)',
                  boxShadow: 'var(--shadow-chip)'
                },
                '@media (hover: none)': {
                  '&:hover': {
                    transform: 'none'
                  }
                }
              }}
            >
              {getPlatformIcon(asset.platform)}
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body)',
                  fontSize: { xs: '13px', sm: 'var(--text-body-small)' },
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-primary)'
                }}
              >
                {asset.platform === 'domain' ? asset.handle : `@${asset.handle}`}
              </Typography>
              {asset.verified && (
                <VerifiedIcon sx={{ fontSize: { xs: 14, sm: 16 }, color: '#7C4DFF' }} />
              )}
            </MuiLink>
          </Tooltip>
        ))}
        {domains.map(asset => (
          <Tooltip key={asset.id} title={asset.handle} arrow>
            <MuiLink
              href={getPlatformUrl(asset)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.75, sm: 1 },
                px: { xs: 1.25, sm: 1.5 },
                py: { xs: 0.75, sm: 1 },
                bgcolor: 'var(--card-background)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-control)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'var(--accent-primary-soft)',
                  borderColor: 'var(--accent-primary)',
                  transform: 'translateY(-2px)',
                  boxShadow: 'var(--shadow-chip)'
                },
                '@media (hover: none)': {
                  '&:hover': {
                    transform: 'none'
                  }
                }
              }}
            >
              {getPlatformIcon(asset.platform)}
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'var(--font-body)',
                  fontSize: { xs: '13px', sm: 'var(--text-body-small)' },
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-primary)'
                }}
              >
                {asset.handle}
              </Typography>
              <ExternalIcon sx={{ fontSize: { xs: 12, sm: 14 }, color: 'var(--icon-default)' }} />
            </MuiLink>
          </Tooltip>
        ))}
      </Box>
    )
  }

  // For affiliated assets, return section with header (used in dedicated section)
  // Now includes its own Card wrapper so parent doesn't need to handle empty state
  if (type === 'affiliated') {
    // Don't show anything if there are no affiliated assets
    if (assets.length === 0) return null

    return (
      <Card>
        <CardContent className="!p-5 space-y-5">
          {/* Social Accounts */}
          {socialAccounts.length > 0 && (
            <div>
              <h3 className="font-display text-base font-semibold text-text-primary mb-2">
                Affiliated Social Accounts
              </h3>

              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: { xs: 1, sm: 1.5 }
              }}>
                {sortedSocial.map(asset => (
                  <Tooltip
                    key={asset.id}
                    title={`@${asset.handle}${asset.follower_tier ? ` • ${asset.follower_tier}` : ''}`}
                    arrow
                  >
                    <MuiLink
                      href={getPlatformUrl(asset)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 0.75, sm: 1 },
                        px: { xs: 1.25, sm: 1.5 },
                        py: { xs: 0.75, sm: 1 },
                        bgcolor: 'var(--subtle-background)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-control)',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: '#FFF8E1',
                          borderColor: '#FFB800',
                          transform: 'translateY(-2px)',
                          boxShadow: 'var(--shadow-chip)'
                        },
                        '@media (hover: none)': {
                          '&:hover': {
                            transform: 'none'
                          }
                        }
                      }}
                    >
                      {getPlatformIcon(asset.platform)}
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'var(--font-body)',
                          fontSize: { xs: '13px', sm: 'var(--text-body-small)' },
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        @{asset.handle}
                      </Typography>
                      <ExternalIcon sx={{ fontSize: { xs: 12, sm: 14 }, color: 'var(--icon-default)' }} />
                    </MuiLink>
                  </Tooltip>
                ))}
              </Box>
            </div>
          )}

          {/* Domains */}
          {domains.length > 0 && (
            <div>
              <h3 className="font-display text-base font-semibold text-text-primary mb-2">
                Affiliated Domains
              </h3>

              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: { xs: 1, sm: 1.5 }
              }}>
                {domains.map(asset => (
                  <Tooltip key={asset.id} title={asset.handle} arrow>
                    <MuiLink
                      href={getPlatformUrl(asset)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 0.75, sm: 1 },
                        px: { xs: 1.25, sm: 1.5 },
                        py: { xs: 0.75, sm: 1 },
                        bgcolor: 'var(--subtle-background)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-control)',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: '#FFF8E1',
                          borderColor: '#FFB800',
                          transform: 'translateY(-2px)',
                          boxShadow: 'var(--shadow-chip)'
                        },
                        '@media (hover: none)': {
                          '&:hover': {
                            transform: 'none'
                          }
                        }
                      }}
                    >
                      {getPlatformIcon(asset.platform)}
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'var(--font-body)',
                          fontSize: { xs: '13px', sm: 'var(--text-body-small)' },
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {asset.handle}
                      </Typography>
                      <ExternalIcon sx={{ fontSize: { xs: 12, sm: 14 }, color: 'var(--icon-default)' }} />
                    </MuiLink>
                  </Tooltip>
                ))}
              </Box>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
}

