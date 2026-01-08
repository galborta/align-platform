/**
 * Social Job Dispute List
 * 
 * Admin interface for reviewing and resolving social media job disputes.
 * Integrates with existing dispute system and sidebar.
 * 
 * Usage:
 * ```tsx
 * <SocialJobDisputeList adminWallet="wallet123..." />
 * ```
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Chip,
  CircularProgress
} from '@mui/material'
import GavelIcon from '@mui/icons-material/Gavel'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

import { supabase } from '@/lib/supabase'
import { isAdminWallet } from '@/lib/admin-auth'
import { ErrorCard, EmptyState } from '@/components/ui/ErrorDisplay'
import { LoadingOverlay } from '@/components/ui/LoadingStates'
import { SocialJobDisputeCard } from './SocialJobDisputeCard'

// ==================== TYPES ====================

interface SocialJobDispute {
  id: string
  job_id: string
  submission_id: string
  opened_by: string
  dispute_type: string
  reason: string
  status: 'pending_admin_review' | 'resolved_poster_favor' | 'resolved_worker_favor'
  created_at: string
  resolved_at?: string
  resolved_by?: string
  admin_notes?: string
  
  // Joined data
  job?: {
    id: string
    title: string
    poster_wallet: string
    social_total_budget_usd?: number
    status?: string
  }
  
  submission?: {
    id: string
    worker_wallet: string
    social_tweet_link?: string
    social_payment_amount_usd?: number
    social_impressions_24h?: number
    social_approval_status?: string
    submitted_at?: string
    updated_at?: string
  }
}

interface SocialJobDisputeListProps {
  adminWallet: string
  highlightDisputeId?: string
}

// ==================== MAIN COMPONENT ====================

export function SocialJobDisputeList({ 
  adminWallet,
  highlightDisputeId 
}: SocialJobDisputeListProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending')
  const [disputes, setDisputes] = useState<SocialJobDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await isAdminWallet(adminWallet)
      setIsAdmin(adminStatus)
      if (!adminStatus) {
        setError('Unauthorized: Admin access required')
        setLoading(false)
      }
    }
    checkAdmin()
  }, [adminWallet])
  
  // Load disputes
  const loadDisputes = useCallback(async () => {
    if (!isAdmin) return
    
    try {
      setLoading(true)
      setError(null)
      
      // Build query for social job disputes
      let query = supabase
        .from('job_disputes')
        .select(`
          id,
          job_id,
          submission_id,
          opened_by,
          dispute_type,
          reason,
          status,
          created_at,
          resolved_at,
          resolved_by,
          admin_notes,
          jobs!inner(
            id,
            title,
            poster_wallet,
            social_total_budget_usd,
            status,
            is_social_media_job
          ),
          job_submissions!inner(
            id,
            worker_wallet,
            social_tweet_link,
            social_payment_amount_usd,
            social_impressions_24h,
            social_approval_status,
            submitted_at,
            updated_at
          )
        `)
        .eq('jobs.is_social_media_job', true)
        .order('created_at', { ascending: false })
      
      // Filter by status
      if (activeTab === 'pending') {
        query = query.eq('status', 'pending_admin_review')
      } else {
        query = query.in('status', ['resolved_poster_favor', 'resolved_worker_favor'])
      }
      
      const { data, error: queryError } = await query
      
      if (queryError) throw queryError
      
      setDisputes(data as unknown as SocialJobDispute[] || [])
      
    } catch (err) {
      console.error('[SocialJobDisputeList] Error loading disputes:', err)
      setError(err instanceof Error ? err.message : 'Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, activeTab])
  
  useEffect(() => {
    loadDisputes()
  }, [loadDisputes])
  
  // Handle dispute resolved
  const handleDisputeResolved = useCallback(() => {
    loadDisputes()
  }, [loadDisputes])
  
  // ==================== RENDER ====================
  
  // Not admin
  if (!isAdmin && !loading) {
    return (
      <Box sx={{ p: 3 }}>
        <ErrorCard
          title="Access Denied"
          error="You must be an admin to view dispute resolutions"
        />
      </Box>
    )
  }
  
  // Loading
  if (loading && disputes.length === 0) {
    return <LoadingOverlay message="Loading disputes..." />
  }
  
  // Error
  if (error && disputes.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <ErrorCard
          title="Failed to Load Disputes"
          error={error}
          onRetry={loadDisputes}
        />
      </Box>
    )
  }
  
  // Get counts
  const pendingCount = disputes.filter(d => d.status === 'pending_admin_review').length
  const resolvedCount = disputes.filter(d => 
    d.status === 'resolved_poster_favor' || d.status === 'resolved_worker_favor'
  ).length
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          borderBottom: '2px solid var(--border-subtle, #E5E7F0)',
          background: 'var(--card-background, #FFFFFF)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <GavelIcon sx={{ fontSize: 32, color: 'var(--accent-primary, #7C4DFF)' }} />
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--text-primary, #1A1A1E)'
            }}
          >
            Social Job Disputes
          </Typography>
        </Box>
        
        <Typography
          sx={{
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontSize: '14px',
            color: 'var(--text-secondary, #6F7280)',
            mb: 3
          }}
        >
          Review and resolve disputes for social media campaigns
        </Typography>
        
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--accent-primary, #7C4DFF)',
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          <Tab
            value="pending"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PendingActionsIcon sx={{ fontSize: 20 }} />
                <span>Pending</span>
                {pendingCount > 0 && (
                  <Chip
                    label={pendingCount}
                    size="small"
                    sx={{
                      height: 20,
                      minWidth: 20,
                      background: '#EF4444',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '11px'
                    }}
                  />
                )}
              </Box>
            }
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'none',
              color: 'var(--text-secondary, #6F7280)',
              '&.Mui-selected': {
                color: 'var(--accent-primary, #7C4DFF)'
              }
            }}
          />
          
          <Tab
            value="resolved"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 20 }} />
                <span>Resolved</span>
                {resolvedCount > 0 && (
                  <Chip
                    label={resolvedCount}
                    size="small"
                    sx={{
                      height: 20,
                      minWidth: 20,
                      background: 'var(--text-muted, #A3A7B5)',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '11px'
                    }}
                  />
                )}
              </Box>
            }
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'none',
              color: 'var(--text-secondary, #6F7280)',
              '&.Mui-selected': {
                color: 'var(--accent-primary, #7C4DFF)'
              }
            }}
          />
        </Tabs>
      </Box>
      
      {/* Dispute List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          background: 'var(--page-background, #F7F8FB)'
        }}
      >
        {disputes.length === 0 ? (
          <EmptyState
            title={activeTab === 'pending' ? 'No Pending Disputes' : 'No Resolved Disputes'}
            message={
              activeTab === 'pending'
                ? 'All clear! There are no disputes awaiting admin review.'
                : 'No disputes have been resolved yet.'
            }
            icon={
              activeTab === 'pending' ? (
                <CheckCircleIcon sx={{ fontSize: 80, color: '#36C170' }} />
              ) : (
                <GavelIcon sx={{ fontSize: 80, color: 'var(--text-muted, #A3A7B5)' }} />
              )
            }
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {disputes.map((dispute) => (
              <SocialJobDisputeCard
                key={dispute.id}
                dispute={dispute}
                onResolved={handleDisputeResolved}
                highlight={dispute.id === highlightDisputeId}
              />
            ))}
          </Box>
        )}
        
        {loading && disputes.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ==================== EXPORTS ====================

export default SocialJobDisputeList

