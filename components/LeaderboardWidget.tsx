'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Dialog } from '@mui/material'
import { UserProfileView } from '@/components/UserProfileView'
import styles from './LeaderboardWidget.module.css'

interface LeaderboardEntry {
  id: string
  wallet_address: string
  username?: string | null
  avatar_url?: string | null
  total_karma: number
  completed_jobs: number
}

interface LeaderboardRowProps {
  rank: number
  entry: LeaderboardEntry
  animationDelay?: number
  onProfileClick: (walletAddress: string) => void
}

interface AvatarFallbackProps {
  address: string
}

// ============================================================================
// Utility Functions
// ============================================================================

function getRankDisplay(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

function formatWalletAddress(address: string): string {
  if (address.length <= 8) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function formatKarma(karma: number): string {
  return karma.toLocaleString('en-US')
}

// ============================================================================
// Sub-Components
// ============================================================================

function AvatarFallback({ address }: AvatarFallbackProps) {
  // Generate consistent gradient based on address hash
  const hue = parseInt(address.slice(0, 8), 36) % 360
  const gradient = `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${hue + 60}, 70%, 50%))`

  const initial = address.charAt(0).toUpperCase()

  return (
    <div className={styles['avatar-fallback']} style={{ background: gradient }}>
      {initial}
    </div>
  )
}

function LeaderboardRow({ rank, entry, animationDelay = 0, onProfileClick }: LeaderboardRowProps) {
  const rankDisplay = getRankDisplay(rank)
  const displayName = entry.username || formatWalletAddress(entry.wallet_address)
  const fullDisplayName = entry.username || entry.wallet_address

  return (
    <li 
      className={styles['leaderboard-row']}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div 
        className={styles['row-link']}
        onClick={() => onProfileClick(entry.wallet_address)}
        style={{ cursor: 'pointer' }}
      >
        {/* Rank */}
        <span className={styles.rank}>{rankDisplay}</span>

        {/* Avatar */}
        <div className={styles.avatar}>
          {entry.avatar_url ? (
            <Image
              src={entry.avatar_url}
              alt={displayName}
              width={40}
              height={40}
              className={styles['avatar-image']}
            />
          ) : (
            <AvatarFallback address={entry.wallet_address} />
          )}
        </div>

        {/* User Info */}
        <div className={styles['user-info']}>
          <div className={styles.username} title={fullDisplayName}>
            {displayName}
          </div>
          <div className={styles.karma}>{formatKarma(entry.total_karma)} karma</div>
        </div>
      </div>
    </li>
  )
}

function LeaderboardSkeleton() {
  return (
    <aside className={styles['leaderboard-widget']}>
      <header className={styles['widget-header']}>
        <h2>🏆 Top Contributors</h2>
      </header>
      <div className={styles['loading-indicator']}>
        <div className={styles.spinner} />
        <span>Loading top contributors...</span>
      </div>
      <ul className={styles['leaderboard-list']}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <li key={i} className={styles['skeleton-row']} />
        ))}
      </ul>
    </aside>
  )
}

// Placeholder data for empty leaderboard
const PLACEHOLDER_ENTRIES = [
  { rank: 1, name: 'Your name here?', karma: '???', emoji: '🥇' },
  { rank: 2, name: 'Future champion', karma: '???', emoji: '🥈' },
  { rank: 3, name: 'Rising star', karma: '???', emoji: '🥉' },
  { rank: 4, name: 'Community builder', karma: '???', emoji: '4.' },
  { rank: 5, name: 'Task master', karma: '???', emoji: '5.' },
]

function LeaderboardEmpty() {
  return (
    <aside className={styles['leaderboard-widget']}>
      <header className={styles['widget-header']}>
        <h2>🏆 Top Contributors</h2>
      </header>
      
      {/* Placeholder Leaderboard */}
      <ul className={styles['leaderboard-list']}>
        {PLACEHOLDER_ENTRIES.map((entry) => (
          <li 
            key={entry.rank}
            className={`${styles['leaderboard-row']} ${styles['placeholder-row']}`}
          >
            <div className={styles['row-link']} style={{ cursor: 'default', opacity: 0.5 }}>
              <span className={styles.rank}>{entry.emoji}</span>
              <div className={styles.avatar}>
                <div 
                  className={styles['avatar-fallback']} 
                  style={{ 
                    background: 'linear-gradient(135deg, #E5E7F0, #D1D5DB)',
                    border: '2px dashed #9CA3AF'
                  }}
                >
                  ?
                </div>
              </div>
              <div className={styles['user-info']}>
                <div className={styles.username} style={{ fontStyle: 'italic' }}>
                  {entry.name}
                </div>
                <div className={styles.karma}>{entry.karma} karma</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className={styles['empty-cta']}>
        <p>Be the first on the leaderboard!</p>
        <Link href="/projects" className={styles['cta-button']}>
          Find Work →
        </Link>
      </div>
    </aside>
  )
}

function LeaderboardError() {
  return (
    <aside className={styles['leaderboard-widget']}>
      <div className={styles['error-state']}>
        <p>Unable to load leaderboard</p>
      </div>
    </aside>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export default function LeaderboardWidget() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showProfileView, setShowProfileView] = useState(false)
  const [selectedProfileWallet, setSelectedProfileWallet] = useState<string | null>(null)

  async function fetchLeaderboard() {
    try {
      setRefreshing(true)
      const response = await fetch('/api/leaderboard?limit=10')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setLeaderboard(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const handleProfileClick = (walletAddress: string) => {
    setSelectedProfileWallet(walletAddress)
    setShowProfileView(true)
  }

  if (loading) return <LeaderboardSkeleton />
  if (error) return <LeaderboardError />
  if (leaderboard.length === 0) return <LeaderboardEmpty />

  // Calculate how many placeholders needed to fill up to 5 entries
  const placeholdersNeeded = Math.max(0, 5 - leaderboard.length)
  const placeholdersToShow = PLACEHOLDER_ENTRIES.slice(leaderboard.length, leaderboard.length + placeholdersNeeded)

  return (
    <aside className={styles['leaderboard-widget']}>
      {/* Header */}
      <header className={styles['widget-header']}>
        <h2>🏆 Top Contributors</h2>
        <button 
          className={`${styles['refresh-button']} ${refreshing ? styles.refreshing : ''}`}
          onClick={fetchLeaderboard}
          disabled={refreshing}
          aria-label="Refresh leaderboard"
          title="Refresh leaderboard"
        >
          ↻
        </button>
      </header>

      {/* Leaderboard List */}
      <ul className={styles['leaderboard-list']}>
        {/* Real entries */}
        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.id}
            rank={index + 1}
            entry={entry}
            animationDelay={index * 0.05}
            onProfileClick={handleProfileClick}
          />
        ))}
        
        {/* Placeholder entries to fill up to 5 */}
        {placeholdersToShow.map((placeholder) => (
          <li 
            key={`placeholder-${placeholder.rank}`}
            className={`${styles['leaderboard-row']} ${styles['placeholder-row']}`}
          >
            <div className={styles['row-link']} style={{ cursor: 'default', opacity: 0.5 }}>
              <span className={styles.rank}>{placeholder.emoji}</span>
              <div className={styles.avatar}>
                <div 
                  className={styles['avatar-fallback']} 
                  style={{ 
                    background: 'linear-gradient(135deg, #E5E7F0, #D1D5DB)',
                    border: '2px dashed #9CA3AF'
                  }}
                >
                  ?
                </div>
              </div>
              <div className={styles['user-info']}>
                <div className={styles.username} style={{ fontStyle: 'italic' }}>
                  {placeholder.name}
                </div>
                <div className={styles.karma}>{placeholder.karma} karma</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer CTA */}
      <footer className={styles['widget-footer']}>
        <Link href="/leaderboard">
          View Full Leaderboard →
        </Link>
      </footer>

      {/* Profile View Modal */}
      <Dialog
        open={showProfileView}
        onClose={() => setShowProfileView(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            maxHeight: '90vh'
          }
        }}
      >
        {selectedProfileWallet && (
          <UserProfileView
            walletAddress={selectedProfileWallet}
            onClose={() => setShowProfileView(false)}
          />
        )}
      </Dialog>
    </aside>
  )
}

