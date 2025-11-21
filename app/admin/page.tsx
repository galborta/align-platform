'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletButton } from '@/components/WalletButton'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { ADMIN_WALLET, isAdminWallet } from '@/lib/admin-auth'
import { saveAdminSession, getAdminSession, isSessionValid, clearAdminSession } from '@/lib/admin-session'
import { useWallet } from '@solana/wallet-adapter-react'
import TwitterIcon from '@mui/icons-material/Twitter'
import InstagramIcon from '@mui/icons-material/Instagram'
import YouTubeIcon from '@mui/icons-material/YouTube'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LockIcon from '@mui/icons-material/Lock'

type Project = Database['public']['Tables']['projects']['Row']
type SocialAsset = Database['public']['Tables']['social_assets']['Row']

interface ProjectWithSocials extends Project {
  social_assets: SocialAsset[]
}

interface SocialAssetWithProject extends SocialAsset {
  projects: Project | null
}

const platformIcons: Record<string, React.ReactNode> = {
  twitter: <TwitterIcon sx={{ fontSize: 24 }} />,
  instagram: <InstagramIcon sx={{ fontSize: 24 }} />,
  youtube: <YouTubeIcon sx={{ fontSize: 24 }} />,
  tiktok: <span className="text-2xl">🎵</span>,
}

const getPlatformUrl = (platform: string, handle: string): string => {
  const urls: Record<string, string> = {
    twitter: `https://twitter.com/${handle}`,
    instagram: `https://instagram.com/${handle}`,
    youtube: `https://youtube.com/@${handle}`,
    tiktok: `https://tiktok.com/@${handle}`,
  }
  return urls[platform] || '#'
}

const shortenAddress = (address: string) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function AdminPage() {
  const { publicKey, signMessage } = useWallet()
  const [pendingProjects, setPendingProjects] = useState<ProjectWithSocials[]>([])
  const [orphanedSocials, setOrphanedSocials] = useState<SocialAssetWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [isVerified, setIsVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const isAdmin = isAdminWallet(publicKey)

  useEffect(() => {
    if (isAdmin) {
      // Check if there's a valid session
      const session = getAdminSession()
      if (session && isSessionValid(publicKey.toBase58())) {
        console.log('Valid admin session found')
        setIsVerified(true)
      } else if (!isVerified) {
        verifyAdmin()
      }
    }
  }, [publicKey, isAdmin])

  useEffect(() => {
    if (isVerified) {
      fetchPendingItems()
    }
  }, [isVerified])

  const verifyAdmin = async () => {
    if (!signMessage || !publicKey) return

    try {
      setVerifying(true)
      
      // Create a message to sign (proves ownership)
      const message = new TextEncoder().encode(
        `Align Admin Access Verification\nTimestamp: ${new Date().toISOString()}\nWallet: ${publicKey.toBase58()}`
      )
      
      // This is SAFE - only signing a message, not a transaction
      const signature = await signMessage(message)
      
      // Save session for 24 hours
      saveAdminSession(publicKey.toBase58(), signature)
      
      console.log('Admin verified successfully - session saved')
      setIsVerified(true)
    } catch (error) {
      console.error('Admin verification failed:', error)
      setIsVerified(false)
      alert('Failed to verify admin access. Please sign the message to continue.')
    } finally {
      setVerifying(false)
    }
  }

  // Handle wallet disconnect
  useEffect(() => {
    if (!publicKey && isVerified) {
      setIsVerified(false)
      clearAdminSession()
    }
  }, [publicKey])

  const fetchPendingItems = async () => {
    try {
      setLoading(true)

      // Fetch ALL projects (not just pending)
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch ALL unverified social assets with project info
      const { data: allSocials, error: socialsError } = await supabase
        .from('social_assets')
        .select('*, projects(*)')
        .eq('verified', false)
        .order('created_at', { ascending: false })

      if (socialsError) throw socialsError

      // Create map of all projects with their unverified socials
      const projectMap = new Map<string, ProjectWithSocials>()
      const orphaned: SocialAssetWithProject[] = []
      
      // First, add all projects to the map (with empty social_assets arrays)
      allProjects?.forEach((project) => {
        projectMap.set(project.id, {
          ...project,
          social_assets: []
        })
      })

      // Then, add unverified socials to their respective projects
      allSocials?.forEach((social: SocialAssetWithProject) => {
        if (social.project_id && projectMap.has(social.project_id)) {
          // Add to existing project
          projectMap.get(social.project_id)!.social_assets.push(social)
        } else if (social.project_id && social.projects) {
          // Project not in main list but social exists - add it
          projectMap.set(social.project_id, { 
            ...social.projects, 
            social_assets: [social] 
          })
        } else {
          // No project - orphaned
          orphaned.push(social)
        }
      })

      // Sort projects: pending first, then by creation date
      const sortedProjects = Array.from(projectMap.values()).sort((a, b) => {
        // Pending projects first
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        // Then by creation date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setPendingProjects(sortedProjects)
      setOrphanedSocials(orphaned as SocialAssetWithProject[])
    } catch (error) {
      console.error('Error fetching pending items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveProject = async (projectId: string) => {
    try {
      setProcessing({ ...processing, [`project-${projectId}`]: true })

      const { data, error } = await supabase
        .from('projects')
        .update({ 
          status: 'live',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Project approved successfully:', data)

      // Update project status in local state (keep it visible if has unverified socials)
      setPendingProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return { ...p, status: 'live' as const, updated_at: new Date().toISOString() }
        }
        return p
      }))

      // Show success message
      alert('Project approved successfully! ✅')
    } catch (error) {
      console.error('Error approving project:', error)
      alert('Failed to approve project. Please try again.')
    } finally {
      setProcessing({ ...processing, [`project-${projectId}`]: false })
    }
  }

  const handleRejectProject = async (projectId: string) => {
    try {
      setProcessing({ ...processing, [`project-${projectId}`]: true })

      const { data, error } = await supabase
        .from('projects')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Project rejected:', data)

      // Update project status in local state (keep it visible if has unverified socials)
      setPendingProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return { ...p, status: 'rejected' as const, updated_at: new Date().toISOString() }
        }
        return p
      }))

      // Show success message
      alert('Project rejected ✓')
    } catch (error) {
      console.error('Error rejecting project:', error)
      alert('Failed to reject project. Please try again.')
    } finally {
      setProcessing({ ...processing, [`project-${projectId}`]: false })
    }
  }

  const handleVerifySocial = async (socialAssetId: string, projectId: string | null) => {
    try {
      setProcessing({ ...processing, [`social-${socialAssetId}`]: true })

      const { error } = await supabase
        .from('social_assets')
        .update({ 
          verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', socialAssetId)

      if (error) throw error

      // Update local state - remove verified social from project
      if (projectId) {
        setPendingProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            const updatedSocials = p.social_assets.filter(s => s.id !== socialAssetId)
            return {
              ...p,
              social_assets: updatedSocials
            }
          }
          return p
        }))
      } else {
        setOrphanedSocials(prev => prev.filter(s => s.id !== socialAssetId))
      }
    } catch (error) {
      console.error('Error verifying social:', error)
      alert('Failed to verify social asset')
    } finally {
      setProcessing({ ...processing, [`social-${socialAssetId}`]: false })
    }
  }

  const handleRejectSocial = async (socialAssetId: string, projectId: string | null) => {
    try {
      setProcessing({ ...processing, [`social-${socialAssetId}`]: true })

      // For MVP, we'll just delete the social asset
      const { error } = await supabase
        .from('social_assets')
        .delete()
        .eq('id', socialAssetId)

      if (error) throw error

      // Update local state - remove rejected social from project
      if (projectId) {
        setPendingProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            const updatedSocials = p.social_assets.filter(s => s.id !== socialAssetId)
            return {
              ...p,
              social_assets: updatedSocials
            }
          }
          return p
        }))
      } else {
        setOrphanedSocials(prev => prev.filter(s => s.id !== socialAssetId))
      }
    } catch (error) {
      console.error('Error rejecting social:', error)
      alert('Failed to reject social asset')
    } finally {
      setProcessing({ ...processing, [`social-${socialAssetId}`]: false })
    }
  }

  // Access denied - not admin wallet
  if (!isAdmin && publicKey) {
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
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center py-12">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <LockIcon sx={{ fontSize: 32, color: '#DC2626' }} />
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
                Access Denied
              </h2>
              <p className="font-body text-text-secondary mb-6">
                This page is restricted to administrators only.
              </p>
              <p className="font-body text-sm text-text-muted mb-6">
                Connected wallet: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
              </p>
              <Link href="/projects">
                <Button variant="primary">
                  Go to Projects
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Wallet not connected
  if (!publicKey) {
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
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center py-12">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-accent-primary-soft rounded-full flex items-center justify-center">
                  <LockIcon sx={{ fontSize: 32, color: '#7C4DFF' }} />
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
                Admin Access Required
              </h2>
              <p className="font-body text-text-secondary mb-6">
                Please connect your wallet to access the admin dashboard.
              </p>
              <WalletButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Admin wallet connected but not verified yet
  if (isAdmin && !isVerified) {
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
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center py-12">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-accent-primary-soft rounded-full flex items-center justify-center">
                  <LockIcon sx={{ fontSize: 32, color: '#7C4DFF' }} />
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
                Verify Admin Access
              </h2>
              <p className="font-body text-text-secondary mb-6">
                Please sign a message to verify your identity. This is safe and won't cost any gas or move funds.
              </p>
              <Button 
                variant="primary" 
                onClick={verifyAdmin}
                disabled={verifying}
              >
                {verifying ? 'Verifying...' : 'Sign to Verify'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Loading data
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
          <p className="font-body text-text-secondary">Loading pending items...</p>
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
            <div className="flex items-center gap-4">
              <Link href="/projects">
                <Button variant="ghost">View Projects</Button>
              </Link>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-2">
            Admin Dashboard
          </h1>
          <p className="font-body text-text-secondary">
            Manage all projects, review pending approvals, and verify social accounts
          </p>
        </div>

        <div className="space-y-6">
          {/* All Projects with Moderation Tools */}
          {pendingProjects.length === 0 && orphanedSocials.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="font-body text-text-muted">
                  No projects found
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingProjects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Profile Image */}
                      <div className="w-12 h-12 rounded-full bg-accent-primary-soft flex items-center justify-center overflow-hidden flex-shrink-0">
                        {project.profile_image_url ? (
                          <img
                            src={project.profile_image_url}
                            alt={project.token_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-lg font-bold text-accent-primary">
                            {project.token_symbol.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <CardTitle className="font-display text-2xl">
                          {project.token_name}
                        </CardTitle>
                        <p className="font-body text-text-secondary">
                          ${project.token_symbol} • Creator: {shortenAddress(project.creator_wallet)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/admin/projects/${project.id}`}>
                        <Button variant="outline" size="sm">
                          Moderate
                        </Button>
                      </Link>
                      <Link 
                        href={`/project/${project.id}`}
                        target="_blank"
                      >
                        <Button variant="ghost" size="sm">
                          View Public
                          <OpenInNewIcon className="ml-2" sx={{ fontSize: 16 }} />
                        </Button>
                      </Link>
                      {project.status === 'pending' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveProject(project.id)}
                            disabled={processing[`project-${project.id}`]}
                          >
                            Approve Project
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectProject(project.id)}
                            disabled={processing[`project-${project.id}`]}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {project.status === 'live' && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                          ✓ Approved
                        </span>
                      )}
                      {project.status === 'rejected' && (
                        <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                          ✗ Rejected
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Social Verifications for this Project */}
                  {project.social_assets && project.social_assets.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-display text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                        Social Verifications ({project.social_assets.length} pending)
                      </h3>
                      {project.social_assets.map((social) => (
                      <div
                        key={social.id}
                        className="p-4 bg-white rounded-lg border border-border-subtle"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {/* Platform Icon */}
                            <div className="text-accent-primary mt-1">
                              {platformIcons[social.platform] || '🌐'}
                            </div>

                            <div className="flex-1">
                              {/* Social Handle */}
                              <h4 className="font-body text-base font-semibold text-text-primary mb-1">
                                @{social.handle}
                              </h4>

                              {/* Platform */}
                              <p className="font-body text-sm text-text-secondary capitalize mb-2">
                                {social.platform}
                                {social.follower_tier && ` • ${social.follower_tier}`}
                              </p>

                              {/* Verification Code */}
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                                <p className="font-body text-xs text-yellow-800 font-semibold mb-1">
                                  VERIFICATION CODE:
                                </p>
                                <p className="font-mono text-sm font-bold text-yellow-900">
                                  {social.verification_code || 'No code generated'}
                                </p>
                              </div>

                              {/* Instructions */}
                              <p className="font-body text-xs text-text-secondary italic mb-2">
                                ℹ️ Check if code is in bio, then approve
                              </p>

                              {/* Profile Link */}
                              <a
                                href={getPlatformUrl(social.platform, social.handle)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-accent-primary hover:text-accent-primary-hover font-body text-sm font-medium"
                              >
                                Open Profile
                                <OpenInNewIcon sx={{ fontSize: 14 }} />
                              </a>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleVerifySocial(social.id, project.id)}
                              disabled={processing[`social-${social.id}`]}
                            >
                              Verify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectSocial(social.id, project.id)}
                              disabled={processing[`social-${social.id}`]}
                              className="border-red-600 text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-text-muted">
                        ✓ No pending social verifications
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))
        )}

        {/* Orphaned Social Verifications (no associated pending project) */}
        {orphanedSocials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Other Social Verifications</span>
                <span className="text-sm font-normal text-text-secondary">
                  {orphanedSocials.length} without pending project
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orphanedSocials.map((social) => (
                  <div
                    key={social.id}
                    className="p-4 bg-white rounded-lg border border-border-subtle"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-accent-primary mt-1">
                          {platformIcons[social.platform] || '🌐'}
                        </div>

                        <div className="flex-1">
                          {social.projects && (
                            <p className="font-display text-xs font-semibold text-text-muted mb-1">
                              {social.projects.token_name} (${social.projects.token_symbol})
                            </p>
                          )}
                          <h4 className="font-body text-base font-semibold text-text-primary mb-1">
                            @{social.handle}
                          </h4>
                          <p className="font-body text-sm text-text-secondary capitalize mb-2">
                            {social.platform}
                            {social.follower_tier && ` • ${social.follower_tier}`}
                          </p>

                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                            <p className="font-body text-xs text-yellow-800 font-semibold mb-1">
                              VERIFICATION CODE:
                            </p>
                            <p className="font-mono text-sm font-bold text-yellow-900">
                              {social.verification_code || 'No code generated'}
                            </p>
                          </div>

                          <a
                            href={getPlatformUrl(social.platform, social.handle)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent-primary hover:text-accent-primary-hover font-body text-sm font-medium"
                          >
                            Open Profile
                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerifySocial(social.id, null)}
                          disabled={processing[`social-${social.id}`]}
                        >
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectSocial(social.id, null)}
                          disabled={processing[`social-${social.id}`]}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  )
}

