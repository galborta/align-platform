'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { isAdminWallet } from '@/lib/admin-auth'
import { saveAdminSession, getAdminSession, isSessionValid, clearAdminSession } from '@/lib/admin-session'
import { AppHeader } from '@/components/AppHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface PendingRelease {
  id: string
  title: string
  assigned_to: string
  escrow_amount_tokens: number
  escrow_token_mint: string | null
  release_scheduled_at: string
  release_paused: boolean
  release_paused_at: string | null
  submitted_at: string
  project_id: string
}

interface ReleaseAttempt {
  id: string
  job_id: string
  transaction_type: string
  status: string
  retry_count: number
  error_message: string | null
  tx_signature: string | null
  created_at: string
  amount_tokens: number
  token_symbol: string
}

interface ReleaseStats {
  totalPending: number
  totalFailed: number
  totalOverdue: number
  successRate: number
}

export default function EscrowReleasesPage() {
  const { publicKey, signMessage } = useWallet()
  const [pending, setPending] = useState<PendingRelease[]>([])
  const [failed, setFailed] = useState<PendingRelease[]>([])
  const [recentAttempts, setRecentAttempts] = useState<ReleaseAttempt[]>([])
  const [stats, setStats] = useState<ReleaseStats>({
    totalPending: 0,
    totalFailed: 0,
    totalOverdue: 0,
    successRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [isVerified, setIsVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const isAdmin = isAdminWallet(publicKey)

  // Admin verification
  useEffect(() => {
    if (isAdmin) {
      const session = getAdminSession()
      if (session && isSessionValid(publicKey!.toBase58())) {
        setIsVerified(true)
      } else if (!isVerified) {
        verifyAdmin()
      }
    }
  }, [publicKey, isAdmin])

  // Load data when verified
  useEffect(() => {
    if (isVerified) {
      loadReleases()
    }
  }, [isVerified])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!isVerified || !autoRefresh) return

    const interval = setInterval(() => {
      loadReleases()
    }, 60000)

    return () => clearInterval(interval)
  }, [isVerified, autoRefresh])

  // Handle wallet disconnect
  useEffect(() => {
    if (!publicKey && isVerified) {
      setIsVerified(false)
      clearAdminSession()
    }
  }, [publicKey])

  const verifyAdmin = async () => {
    if (!signMessage || !publicKey) return

    try {
      setVerifying(true)
      const message = new TextEncoder().encode(
        `Orggly Admin - Escrow Releases Access\nTimestamp: ${new Date().toISOString()}\nWallet: ${publicKey.toBase58()}`
      )
      const signature = await signMessage(message)
      saveAdminSession(publicKey.toBase58(), signature)
      setIsVerified(true)
    } catch (error) {
      console.error('Admin verification failed:', error)
      alert('Failed to verify admin access. Please sign the message to continue.')
    } finally {
      setVerifying(false)
    }
  }

  const loadReleases = async () => {
    try {
      setLoading(true)

      // Get pending releases (scheduled for auto-release)
      const { data: pendingData, error: pendingError } = await supabase
        .from('jobs')
        .select('id, title, assigned_to, escrow_amount_tokens, escrow_token_mint, release_scheduled_at, release_paused, release_paused_at, submitted_at, project_id')
        .eq('status', 'submitted')
        .eq('release_paused', false)
        .not('release_scheduled_at', 'is', null)
        .order('release_scheduled_at', { ascending: true })
        .limit(50)

      // Get failed releases (paused by system)
      const { data: failedData, error: failedError } = await supabase
        .from('jobs')
        .select('id, title, assigned_to, escrow_amount_tokens, escrow_token_mint, release_scheduled_at, release_paused, release_paused_at, submitted_at, project_id')
        .eq('status', 'submitted')
        .eq('release_paused', true)
        .order('release_paused_at', { ascending: false })
        .limit(50)

      // Get recent release attempts for monitoring
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('job_escrow_transactions')
        .select('id, job_id, transaction_type, status, retry_count, error_message, tx_signature, created_at, amount_tokens, token_symbol')
        .eq('transaction_type', 'release_to_worker')
        .order('created_at', { ascending: false })
        .limit(20)

      if (pendingError) {
        console.error('Error loading pending:', {
          code: pendingError.code,
          message: pendingError.message
        })
      }
      if (failedError) {
        console.error('Error loading failed:', {
          code: failedError.code,
          message: failedError.message
        })
      }
      if (attemptsError) {
        console.error('Error loading attempts:', {
          code: attemptsError.code,
          message: attemptsError.message
        })
      }

      const pendingList = (pendingData || []) as PendingRelease[]
      const failedList = (failedData || []) as PendingRelease[]

      setPending(pendingList)
      setFailed(failedList)
      setRecentAttempts((attemptsData || []) as ReleaseAttempt[])

      // Calculate stats
      const now = new Date()
      const overdue = pendingList.filter(job => 
        new Date(job.release_scheduled_at) <= now
      ).length

      const totalAttempts = attemptsData?.length || 0
      const successfulAttempts = attemptsData?.filter(a => a.status === 'confirmed').length || 0
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0

      setStats({
        totalPending: pendingList.length,
        totalFailed: failedList.length,
        totalOverdue: overdue,
        successRate: Math.round(successRate)
      })

    } catch (error) {
      console.error('Error loading releases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualRelease = async (jobId: string) => {
    if (!confirm('Are you sure you want to manually release this payment now?')) {
      return
    }

    try {
      setProcessing(prev => ({ ...prev, [jobId]: true }))

      const response = await fetch(`/api/admin/jobs/${jobId}/manual-release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`✅ Payment released successfully!\n\nWorker received: ${result.workerReceived} tokens\nTx: ${result.workerTxSignature}`)
        await loadReleases()
      } else {
        alert(`❌ Failed to release payment:\n${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error releasing payment:', error)
      alert('Failed to release payment. Check console for details.')
    } finally {
      setProcessing(prev => ({ ...prev, [jobId]: false }))
    }
  }

  const handlePauseRelease = async (jobId: string) => {
    try {
      setProcessing(prev => ({ ...prev, [jobId]: true }))

      const { error } = await supabase
        .from('jobs')
        .update({
          release_paused: true,
          release_paused_at: new Date().toISOString(),
          release_paused_by: publicKey?.toBase58() || 'admin'
        })
        .eq('id', jobId)

      if (error) throw error

      alert('✅ Auto-release paused successfully')
      await loadReleases()
    } catch (error) {
      console.error('Error pausing release:', error)
      alert('Failed to pause auto-release')
    } finally {
      setProcessing(prev => ({ ...prev, [jobId]: false }))
    }
  }

  const handleResumeRelease = async (jobId: string) => {
    try {
      setProcessing(prev => ({ ...prev, [jobId]: true }))

      const { error } = await supabase
        .from('jobs')
        .update({
          release_paused: false,
          release_paused_by: null,
          release_paused_at: null
        })
        .eq('id', jobId)

      if (error) throw error

      alert('✅ Auto-release resumed successfully')
      await loadReleases()
    } catch (error) {
      console.error('Error resuming release:', error)
      alert('Failed to resume auto-release')
    } finally {
      setProcessing(prev => ({ ...prev, [jobId]: false }))
    }
  }

  // Filter functions
  const filterJobs = (jobs: PendingRelease[]) => {
    return jobs.filter(job => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery || 
        job.title.toLowerCase().includes(searchLower) ||
        job.assigned_to.toLowerCase().includes(searchLower) ||
        job.id.toLowerCase().includes(searchLower)

      return matchesSearch
    })
  }

  const getTimeUntilRelease = (scheduledAt: string) => {
    const now = new Date()
    const scheduled = new Date(scheduledAt)
    const diffMs = scheduled.getTime() - now.getTime()
    
    if (diffMs < 0) {
      const overdueMins = Math.floor(Math.abs(diffMs) / 1000 / 60)
      if (overdueMins < 60) return `${overdueMins}m overdue`
      const overdueHours = Math.floor(overdueMins / 60)
      return `${overdueHours}h overdue`
    }

    const mins = Math.floor(diffMs / 1000 / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ${mins % 60}m`
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  const isOverdue = (scheduledAt: string) => {
    return new Date(scheduledAt) <= new Date()
  }

  const shortenWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
  }

  // Render unauthorized state
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-page-bg">
        <AppHeader />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-text-primary mb-4">
                Admin Access Required
              </h2>
              <p className="font-body text-text-secondary">
                Please connect your admin wallet to access the Escrow Releases Dashboard.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-page-bg">
        <AppHeader />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🚫</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-text-primary mb-4">
                Unauthorized
              </h2>
              <p className="font-body text-text-secondary">
                This wallet does not have admin privileges.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-page-bg">
        <AppHeader />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
              <h2 className="font-display text-xl font-bold text-text-primary mb-2">
                Verifying Admin Access
              </h2>
              <p className="font-body text-text-secondary">
                Please sign the message in your wallet...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const filteredPending = filterJobs(pending)
  const filteredFailed = filterJobs(failed)

  return (
    <div className="min-h-screen bg-page-bg">
      <AppHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="font-display text-4xl font-bold text-text-primary">
              🔄 Escrow Releases Dashboard
            </h1>
            <div className="flex gap-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-500' : 'bg-gray-400'}
              >
                {autoRefresh ? '▶ Auto-refresh' : '⏸ Paused'}
              </Button>
              <Button onClick={loadReleases}>
                🔄 Refresh
              </Button>
            </div>
          </div>
          <p className="font-body text-text-secondary">
            Monitor and manage automatic payment releases
            {autoRefresh && ' • Auto-refreshing every 60s'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="font-body text-sm text-text-muted mb-1">Pending Releases</p>
              <p className="font-display text-3xl font-bold text-blue-600">{stats.totalPending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-body text-sm text-text-muted mb-1">Overdue</p>
              <p className="font-display text-3xl font-bold text-orange-600">{stats.totalOverdue}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-body text-sm text-text-muted mb-1">Failed (Paused)</p>
              <p className="font-display text-3xl font-bold text-red-600">{stats.totalFailed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-body text-sm text-text-muted mb-1">Success Rate</p>
              <p className="font-display text-3xl font-bold text-green-600">{stats.successRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <input
              type="text"
              placeholder="🔍 Search by job title, ID, or worker wallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
          </div>
        ) : (
          <>
            {/* Pending Auto-Releases */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  ⏰ Pending Auto-Releases ({filteredPending.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredPending.length === 0 ? (
                  <p className="text-center py-8 text-text-muted">No pending releases found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Job</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Worker</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Amount</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Scheduled</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Time Until</th>
                          <th className="text-right py-3 px-4 font-body text-sm text-text-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPending.map(job => (
                          <tr 
                            key={job.id}
                            className={`border-b border-border-subtle hover:bg-gray-50 ${isOverdue(job.release_scheduled_at) ? 'bg-red-50' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <p className="font-body font-medium text-text-primary">{job.title}</p>
                              <p className="font-body text-xs text-text-muted">ID: {job.id.slice(0, 8)}...</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-mono text-sm text-blue-600">{shortenWallet(job.assigned_to)}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-body font-semibold text-text-primary">{job.escrow_amount_tokens} tokens</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-body text-sm text-text-secondary">{new Date(job.release_scheduled_at).toLocaleString()}</p>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${isOverdue(job.release_scheduled_at) ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {getTimeUntilRelease(job.release_scheduled_at)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleManualRelease(job.id)}
                                  disabled={processing[job.id]}
                                  className="bg-green-600 text-white hover:bg-green-700 text-xs px-3 py-1"
                                >
                                  {processing[job.id] ? 'Releasing...' : 'Release Now'}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handlePauseRelease(job.id)}
                                  disabled={processing[job.id]}
                                  className="bg-red-600 text-white hover:bg-red-700 text-xs px-3 py-1"
                                >
                                  Pause
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Failed Auto-Releases */}
            {filteredFailed.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="font-display text-2xl text-red-600">
                    ❌ Failed Auto-Releases ({filteredFailed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="font-body text-sm text-red-800">
                      ⚠️ These releases failed after 3 retry attempts and require admin intervention
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Job</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Worker</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Amount</th>
                          <th className="text-left py-3 px-4 font-body text-sm text-text-muted">Error</th>
                          <th className="text-right py-3 px-4 font-body text-sm text-text-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFailed.map(job => (
                          <tr key={job.id} className="border-b border-border-subtle hover:bg-red-50">
                            <td className="py-3 px-4">
                              <p className="font-body font-medium text-text-primary">{job.title}</p>
                              <p className="font-body text-xs text-text-muted">ID: {job.id.slice(0, 8)}...</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-mono text-sm text-blue-600">{shortenWallet(job.assigned_to)}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-body font-semibold text-text-primary">{job.escrow_amount_tokens} tokens</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-body text-xs text-red-600">
                                Failed after 3 retry attempts
                              </p>
                              <p className="font-body text-xs text-text-muted">
                                Paused: {new Date(job.release_paused_at!).toLocaleString()}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleManualRelease(job.id)}
                                  disabled={processing[job.id]}
                                  className="bg-green-600 text-white hover:bg-green-700 text-xs px-3 py-1 font-bold"
                                >
                                  {processing[job.id] ? 'Releasing...' : 'Manual Release'}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleResumeRelease(job.id)}
                                  disabled={processing[job.id]}
                                  className="bg-blue-600 text-white hover:bg-blue-700 text-xs px-3 py-1"
                                >
                                  Resume Auto-Release
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Release Attempts */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  📊 Recent Release Attempts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentAttempts.length === 0 ? (
                  <p className="text-center py-8 text-text-muted">No recent attempts</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left py-2 px-3 font-body text-xs text-text-muted">Job ID</th>
                          <th className="text-left py-2 px-3 font-body text-xs text-text-muted">Amount</th>
                          <th className="text-left py-2 px-3 font-body text-xs text-text-muted">Status</th>
                          <th className="text-left py-2 px-3 font-body text-xs text-text-muted">Attempt</th>
                          <th className="text-left py-2 px-3 font-body text-xs text-text-muted">Time</th>
                          <th className="text-left py-2 px-3 font-body text-xs text-text-muted">Tx Signature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAttempts.slice(0, 10).map(attempt => (
                          <tr key={attempt.id} className="border-b border-border-subtle hover:bg-gray-50">
                            <td className="py-2 px-3">
                              <p className="font-mono text-xs text-text-secondary">{attempt.job_id.slice(0, 8)}...</p>
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-body text-xs text-text-primary">{attempt.amount_tokens} {attempt.token_symbol}</p>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${attempt.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {attempt.status === 'confirmed' ? '✓ OK' : '✗ FAIL'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                                #{attempt.retry_count}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-body text-xs text-text-secondary">{new Date(attempt.created_at).toLocaleString()}</p>
                            </td>
                            <td className="py-2 px-3">
                              {attempt.tx_signature ? (
                                <a
                                  href={`https://solscan.io/tx/${attempt.tx_signature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  {attempt.tx_signature.slice(0, 8)}...
                                </a>
                              ) : (
                                <p className="font-body text-xs text-red-600">{attempt.error_message?.slice(0, 30)}...</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
