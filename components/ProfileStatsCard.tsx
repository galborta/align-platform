'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { getProfileStats, ProfileStats } from '@/lib/profile-stats'
import CircularProgress from '@mui/material/CircularProgress'
import StarIcon from '@mui/icons-material/Star'
import WorkIcon from '@mui/icons-material/Work'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import GavelIcon from '@mui/icons-material/Gavel'

interface ProfileStatsCardProps {
  walletAddress: string
  projectId: string
}

export function ProfileStatsCard({ walletAddress, projectId }: ProfileStatsCardProps) {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [walletAddress, projectId])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const data = await getProfileStats(walletAddress, projectId)
      setStats(data)
    } catch (error) {
      console.error('Error fetching profile stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <CircularProgress sx={{ color: '#7C4DFF' }} />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card>
      <CardContent className="p-6">
        <h3 
          className="text-xl font-bold mb-4"
          style={{ 
            fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
            color: '#1A1A1E'
          }}
        >
          Profile Statistics
        </h3>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Total Karma - Purple */}
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#F8F5FF' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <StarIcon sx={{ fontSize: 20, color: '#7C4DFF' }} />
              <span 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#7C4DFF' }}
              >
                Total Karma
              </span>
            </div>
            <p 
              className="text-2xl font-bold"
              style={{ color: '#7C4DFF' }}
            >
              {stats.totalKarma.toLocaleString()}
            </p>
          </div>

          {/* Jobs Completed - Green */}
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#E3F8ED' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <WorkIcon sx={{ fontSize: 20, color: '#36C170' }} />
              <span 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#36C170' }}
              >
                Jobs Done
              </span>
            </div>
            <p 
              className="text-2xl font-bold"
              style={{ color: '#36C170' }}
            >
              {stats.totalJobsCompleted}
            </p>
          </div>

          {/* Win Rate - Blue */}
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#E8F4FF' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUpIcon sx={{ fontSize: 20, color: '#2563EB' }} />
              <span 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#2563EB' }}
              >
                Win Rate
              </span>
            </div>
            <p 
              className="text-2xl font-bold"
              style={{ color: '#2563EB' }}
            >
              {stats.applicationWinRate.toFixed(0)}%
            </p>
            <p 
              className="text-xs mt-1"
              style={{ color: '#6F7280' }}
            >
              {stats.applicationsSubmitted} applications
            </p>
          </div>

          {/* Dispute Accuracy - Orange */}
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#FFF4ED' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <GavelIcon sx={{ fontSize: 20, color: '#FB923C' }} />
              <span 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#FB923C' }}
              >
                Dispute Accuracy
              </span>
            </div>
            <p 
              className="text-2xl font-bold"
              style={{ color: '#FB923C' }}
            >
              {stats.disputeAccuracy.toFixed(0)}%
            </p>
            <p 
              className="text-xs mt-1"
              style={{ color: '#6F7280' }}
            >
              {stats.disputesVoted} votes cast
            </p>
          </div>
        </div>

        {/* Jobs Posted - Only show if > 0 */}
        {stats.totalJobsPosted > 0 && (
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#F8F9FC' }}
          >
            <div className="flex items-center justify-between">
              <span 
                className="text-sm font-semibold"
                style={{ color: '#6F7280' }}
              >
                Jobs Posted as Client
              </span>
              <span 
                className="text-lg font-bold"
                style={{ color: '#1A1A1E' }}
              >
                {stats.totalJobsPosted}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}







