'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import CircularProgress from '@mui/material/CircularProgress'
import Image from 'next/image'
import { Database } from '@/types/database'

type PendingAsset = Database['public']['Tables']['pending_assets']['Row']

interface PendingAssetsSectionProps {
  projectId: string
  canApprove: boolean // Only true for editors/creator
}

export function PendingAssetsSection({ projectId, canApprove }: PendingAssetsSectionProps) {
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [processingAsset, setProcessingAsset] = useState<string | null>(null)

  useEffect(() => {
    fetchPendingAssets()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`pending-assets-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_assets',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchPendingAssets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  const fetchPendingAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_assets')
        .select('*')
        .eq('project_id', projectId)
        .eq('asset_type', 'social')
        .in('verification_status', ['pending', 'backed'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingAssets(data || [])
    } catch (error) {
      console.error('Error fetching pending assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (asset: PendingAsset) => {
    setProcessingAsset(asset.id)
    try {
      const response = await fetch('/api/assets/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          project_id: projectId,
          action: 'approve'
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve asset')
      }

      // Refresh list
      await fetchPendingAssets()
    } catch (error) {
      console.error('Error approving asset:', error)
      alert(error instanceof Error ? error.message : 'Failed to approve asset')
    } finally {
      setProcessingAsset(null)
    }
  }

  const handleReject = async (asset: PendingAsset) => {
    const reason = prompt('Optional: Why are you rejecting this asset?')
    
    // User cancelled prompt
    if (reason === null) return
    
    setProcessingAsset(asset.id)
    try {
      const response = await fetch('/api/assets/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          project_id: projectId,
          action: 'reject',
          rejection_reason: reason || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject asset')
      }

      // Refresh list
      await fetchPendingAssets()
    } catch (error) {
      console.error('Error rejecting asset:', error)
      alert(error instanceof Error ? error.message : 'Failed to reject asset')
    } finally {
      setProcessingAsset(null)
    }
  }

  const getPlatformIcon = (platform: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      twitter: <Image src="/logos/xlogo.png" alt="X" width={20} height={20} className="object-contain" />,
      x: <Image src="/logos/xlogo.png" alt="X" width={20} height={20} className="object-contain" />,
      instagram: <Image src="/logos/instagram logo.png" alt="Instagram" width={20} height={20} className="object-contain" />,
      youtube: <Image src="/logos/youtubelogo.png" alt="YouTube" width={20} height={20} className="object-contain" />,
      tiktok: <Image src="/logos/tiktoklogo.png" alt="TikTok" width={20} height={20} className="object-contain" />,
    }
    return iconMap[platform.toLowerCase()] || <span style={{ fontSize: '20px' }}>🌐</span>
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const getStatusBadge = (status: string | null) => {
    if (status === 'backed') {
      return (
        <span
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--accent-warning)',
            color: 'white',
            borderRadius: 'var(--radius-control)',
            fontSize: 'var(--text-caption)',
            fontWeight: 'var(--weight-medium)',
            fontFamily: 'var(--font-body)',
          }}
        >
          BACKED
        </span>
      )
    }
    return (
      <span
        style={{
          padding: '4px 8px',
          backgroundColor: '#E5E7F0',
          color: 'var(--text-secondary)',
          borderRadius: 'var(--radius-control)',
          fontSize: 'var(--text-caption)',
          fontWeight: 'var(--weight-medium)',
          fontFamily: 'var(--font-body)',
        }}
      >
        PENDING
      </span>
    )
  }

  // Don't show to non-editors
  if (!canApprove) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Assets for Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--space-xl)',
            }}
          >
            <CircularProgress size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (pendingAssets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Assets for Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-xl)',
              backgroundColor: 'var(--subtle-background)',
              borderRadius: 'var(--radius-card)',
              border: '2px dashed var(--border-subtle)',
            }}
          >
            <CheckCircleIcon
              sx={{
                fontSize: 48,
                color: 'var(--icon-default)',
                mb: 2,
              }}
            />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body-small)',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              No pending assets to review
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-muted)',
                marginTop: 'var(--space-xs)',
              }}
            >
              Assets submitted by the community will appear here for approval
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Pending Assets for Review
          <span
            style={{
              marginLeft: 'var(--space-sm)',
              padding: '4px 12px',
              backgroundColor: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              borderRadius: 'var(--radius-control)',
              fontSize: 'var(--text-body-small)',
              fontWeight: 'var(--weight-semibold)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {pendingAssets.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {pendingAssets.map((asset) => {
            const data = asset.asset_data as any
            const isProcessing = processingAsset === asset.id

            return (
              <div
                key={asset.id}
                style={{
                  padding: 'var(--space-lg)',
                  backgroundColor: 'var(--card-background)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-card-lg)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-chip)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                  {/* Left side - Asset info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                      <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getPlatformIcon(data.platform)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: 'var(--text-headline)',
                            fontWeight: 'var(--weight-semibold)',
                            color: 'var(--text-primary)',
                            margin: 0,
                            marginBottom: '2px',
                          }}
                        >
                          {data.platform.charAt(0).toUpperCase() + data.platform.slice(1)} - @{data.handle}
                        </p>
                        <p
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-muted)',
                            margin: 0,
                          }}
                        >
                          by {shortenAddress(asset.submitter_wallet)}
                        </p>
                      </div>
                      {getStatusBadge(asset.verification_status)}
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                        <ThumbUpIcon sx={{ fontSize: 16, color: 'var(--accent-success)' }} />
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-secondary)',
                            fontWeight: 'var(--weight-medium)',
                          }}
                        >
                          {asset.unique_upvoters_count || 0} upvotes
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-caption)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        •
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-caption)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {new Date(asset.created_at || '').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {data.follower_tier && (
                        <>
                          <span
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-caption)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            •
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-caption)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {data.follower_tier} followers
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right side - Action buttons */}
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexShrink: 0 }}>
                    <Button
                      onClick={() => handleApprove(asset)}
                      disabled={isProcessing}
                      variant="primary"
                      size="md"
                      style={{
                        backgroundColor: 'var(--accent-success)',
                        minWidth: '100px',
                      }}
                    >
                      {isProcessing ? (
                        <CircularProgress size={16} style={{ color: 'white' }} />
                      ) : (
                        <>
                          <CheckCircleIcon sx={{ fontSize: 18, mr: 0.5 }} />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleReject(asset)}
                      disabled={isProcessing}
                      variant="outline"
                      size="md"
                      style={{
                        borderColor: '#EF4444',
                        color: '#EF4444',
                        minWidth: '100px',
                      }}
                    >
                      {isProcessing ? (
                        <CircularProgress size={16} style={{ color: '#EF4444' }} />
                      ) : (
                        <>
                          <CancelIcon sx={{ fontSize: 18, mr: 0.5 }} />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

