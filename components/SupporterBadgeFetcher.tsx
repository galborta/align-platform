'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SupporterBadge } from './SupporterBadge'

interface SupporterBadgeFetcherProps {
  walletAddress: string
  projectId: string
  size?: 'small' | 'medium'
}

export function SupporterBadgeFetcher({ 
  walletAddress, 
  projectId, 
  size = 'small' 
}: SupporterBadgeFetcherProps) {
  const [completedJobs, setCompletedJobs] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompletedJobs()
  }, [walletAddress, projectId])

  const fetchCompletedJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_karma')
        .select('jobs_completed_as_worker_count')
        .eq('wallet_address', walletAddress)
        .eq('project_id', projectId)
        .maybeSingle()

      // Supabase may return an empty error object or PGRST116 when no rows exist
      // This is expected behavior, not an actual error, so we silently handle it
      
      // Set completed jobs (0 if no record exists)
      setCompletedJobs(data?.jobs_completed_as_worker_count || 0)
    } catch (error) {
      // Only log unexpected errors (not from Supabase response)
      console.error('Unexpected error fetching completed jobs:', error)
      setCompletedJobs(0)
    } finally {
      setLoading(false)
    }
  }

  if (loading || completedJobs === 0) return null

  return <SupporterBadge completedJobsCount={completedJobs} size={size} />
}


