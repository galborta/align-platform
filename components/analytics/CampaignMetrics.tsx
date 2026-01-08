/**
 * Campaign Metrics Dashboard
 * 
 * Comprehensive analytics dashboard for social media campaign performance.
 * Displays key metrics, trends, and insights for campaign posters.
 * 
 * Usage:
 * ```tsx
 * <CampaignMetricsDashboard posterWallet="wallet123..." />
 * ```
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Box, Grid, Typography, Card, CardContent } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import CampaignIcon from '@mui/icons-material/Campaign'
import PeopleIcon from '@mui/icons-material/People'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import TimerIcon from '@mui/icons-material/Timer'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

import { getCampaignMetrics, type CampaignMetrics } from '@/lib/analytics'
import { LoadingOverlay } from '@/components/ui/LoadingStates'
import { ErrorCard } from '@/components/ui/ErrorDisplay'

// ==================== METRIC CARD ====================

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  icon?: React.ReactNode
  color?: string
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend,
  icon,
  color = 'var(--accent-primary, #7C4DFF)'
}: MetricCardProps) {
  const hasTrend = trend !== undefined && !isNaN(trend)
  const isPositiveTrend = hasTrend && trend >= 0
  
  return (
    <Card
      sx={{
        height: '100%',
        background: 'var(--card-background, #FFFFFF)',
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: '2px solid var(--border-subtle, #E5E7F0)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
          borderColor: color
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header with icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {icon && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: '12px',
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {React.cloneElement(icon as React.ReactElement, {
                sx: { fontSize: 24, color }
              })}
            </Box>
          )}
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-secondary, #6F7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {title}
          </Typography>
        </Box>
        
        {/* Value */}
        <Typography
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1,
            lineHeight: 1
          }}
        >
          {value}
        </Typography>
        
        {/* Subtitle and trend */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {subtitle && (
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '13px',
                color: 'var(--text-muted, #A3A7B5)'
              }}
            >
              {subtitle}
            </Typography>
          )}
          
          {hasTrend && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: '6px',
                background: isPositiveTrend 
                  ? 'rgba(54, 193, 112, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)'
              }}
            >
              {isPositiveTrend ? (
                <TrendingUpIcon sx={{ fontSize: 16, color: '#36C170' }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 16, color: '#EF4444' }} />
              )}
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isPositiveTrend ? '#36C170' : '#EF4444'
                }}
              >
                {Math.abs(trend).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

// ==================== DETAIL CARD ====================

interface DetailRowProps {
  label: string
  value: string | number
  icon?: React.ReactNode
}

function DetailRow({ label, value, icon }: DetailRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
        borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
        '&:last-child': {
          borderBottom: 'none'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '14px',
            color: 'var(--text-secondary, #6F7280)'
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: 'var(--font-body, Satoshi, sans-serif)',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary, #1A1A1E)'
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

interface DetailCardProps {
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
}

function DetailCard({ title, children, icon }: DetailCardProps) {
  return (
    <Card
      sx={{
        background: 'var(--card-background, #FFFFFF)',
        borderRadius: 'var(--radius-card-lg, 24px)',
        border: '2px solid var(--border-subtle, #E5E7F0)',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          {icon}
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

// ==================== MAIN DASHBOARD ====================

interface CampaignMetricsDashboardProps {
  posterWallet?: string
}

export function CampaignMetricsDashboard({ posterWallet }: CampaignMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true)
        setError(null)
        const data = await getCampaignMetrics(posterWallet)
        setMetrics(data)
      } catch (err) {
        console.error('Error loading metrics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    
    loadMetrics()
  }, [posterWallet])
  
  // Loading state
  if (loading) {
    return <LoadingOverlay message="Loading analytics..." />
  }
  
  // Error state
  if (error || !metrics) {
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto', p: 3 }}>
        <ErrorCard
          title="Failed to Load Analytics"
          error={error || 'No data available'}
          onRetry={() => window.location.reload()}
        />
      </Box>
    )
  }
  
  // Main dashboard
  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: { xs: '28px', sm: '36px' },
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 1
          }}
        >
          Campaign Analytics
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '16px',
            color: 'var(--text-secondary, #6F7280)'
          }}
        >
          {posterWallet 
            ? 'Your campaign performance metrics'
            : 'Platform-wide campaign analytics'
          }
        </Typography>
      </Box>
      
      {/* Top Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Campaigns"
            value={metrics.totalCampaigns}
            subtitle={`${metrics.activeCampaigns} active`}
            trend={metrics.growthRate}
            icon={<CampaignIcon />}
            color="var(--accent-primary, #7C4DFF)"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Budget"
            value={`$${metrics.totalBudgetLocked.toLocaleString()}`}
            subtitle={`$${metrics.totalPaid.toLocaleString()} paid`}
            icon={<AttachMoneyIcon />}
            color="var(--accent-success, #36C170)"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Submissions"
            value={metrics.totalSubmissions}
            subtitle={`${metrics.submissionsThisWeek} this week`}
            icon={<PeopleIcon />}
            color="var(--accent-warning, #FFC857)"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Approval Rate"
            value={`${metrics.approvalRate.toFixed(1)}%`}
            subtitle={`${metrics.pendingSubmissions} pending`}
            icon={<ThumbUpIcon />}
            color="#36C170"
          />
        </Grid>
      </Grid>
      
      {/* Detail Cards Grid */}
      <Grid container spacing={3}>
        {/* Participation Metrics */}
        <Grid item xs={12} md={6}>
          <DetailCard 
            title="Participation Metrics"
            icon={<PeopleIcon sx={{ fontSize: 24, color: 'var(--accent-primary, #7C4DFF)' }} />}
          >
            <DetailRow
              label="Average Participants"
              value={metrics.averageParticipants.toFixed(1)}
            />
            <DetailRow
              label="Approved Submissions"
              value={`${metrics.approvalRate.toFixed(1)}%`}
            />
            <DetailRow
              label="Rejected Submissions"
              value={`${metrics.rejectionRate.toFixed(1)}%`}
            />
            <DetailRow
              label="Pending Review"
              value={metrics.pendingSubmissions}
            />
          </DetailCard>
        </Grid>
        
        {/* Financial Metrics */}
        <Grid item xs={12} md={6}>
          <DetailCard 
            title="Financial Overview"
            icon={<AttachMoneyIcon sx={{ fontSize: 24, color: '#36C170' }} />}
          >
            <DetailRow
              label="Budget Locked"
              value={`$${metrics.totalBudgetLocked.toLocaleString()}`}
            />
            <DetailRow
              label="Total Paid"
              value={`$${metrics.totalPaid.toLocaleString()}`}
            />
            <DetailRow
              label="Budget Utilization"
              value={`${metrics.totalBudgetUtilization.toFixed(1)}%`}
            />
            <DetailRow
              label="Average Budget"
              value={`$${metrics.averageBudget.toFixed(0)}`}
            />
          </DetailCard>
        </Grid>
        
        {/* Approval Breakdown */}
        <Grid item xs={12} md={6}>
          <DetailCard 
            title="Approval Breakdown"
            icon={<AutoAwesomeIcon sx={{ fontSize: 24, color: '#FFC857' }} />}
          >
            <DetailRow
              label="Manual Approvals"
              value={`${metrics.manualApprovalRate.toFixed(1)}%`}
            />
            <DetailRow
              label="Auto Approvals"
              value={`${metrics.autoApprovalRate.toFixed(1)}%`}
            />
            <DetailRow
              label="Overall Approval Rate"
              value={`${metrics.approvalRate.toFixed(1)}%`}
            />
          </DetailCard>
        </Grid>
        
        {/* Efficiency Metrics */}
        <Grid item xs={12} md={6}>
          <DetailCard 
            title="Efficiency Metrics"
            icon={<TimerIcon sx={{ fontSize: 24, color: '#7C4DFF' }} />}
          >
            <DetailRow
              label="Avg Time to Payment"
              value={`${metrics.averageTimeToPayment.toFixed(1)}h`}
            />
            <DetailRow
              label="Avg Time to Submit"
              value={`${metrics.averageTimeToSubmission.toFixed(1)}h`}
            />
            <DetailRow
              label="Campaigns This Week"
              value={metrics.campaignsThisWeek}
            />
            <DetailRow
              label="Weekly Growth"
              value={`${metrics.growthRate >= 0 ? '+' : ''}${metrics.growthRate.toFixed(1)}%`}
            />
          </DetailCard>
        </Grid>
      </Grid>
    </Box>
  )
}

// ==================== EXPORTS ====================

export default CampaignMetricsDashboard

