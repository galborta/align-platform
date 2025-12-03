'use client'

import { Database } from '@/types/database'
import ContestJobCard from './ContestJobCard'
import RegularJobCard from './RegularJobCard'
import { SocialMediaJobCard } from './jobs'

type Job = Database['public']['Tables']['jobs']['Row']

interface JobCardProps {
  job: Job
  submissionCount?: number
  applicationCount?: number
  projectName?: string
  tokenSymbol?: string
}

export default function JobCard({ 
  job, 
  submissionCount, 
  applicationCount,
  projectName,
  tokenSymbol
}: JobCardProps) {
  // Route to appropriate card based on job type
  
  // Social media jobs get their own card type
  if (job.is_social_media_job) {
    return (
      <SocialMediaJobCard 
        job={job} 
        submissionCount={submissionCount} 
        projectName={projectName}
        tokenSymbol={tokenSymbol}
      />
    )
  }
  
  // Contest jobs
  if (job.is_contest) {
    return (
      <ContestJobCard 
        job={job} 
        submissionCount={submissionCount} 
        projectName={projectName}
        tokenSymbol={tokenSymbol}
      />
    )
  }

  // Regular jobs
  return (
    <RegularJobCard 
      job={job} 
      projectName={projectName}
      tokenSymbol={tokenSymbol}
      applicationCount={applicationCount}
    />
  )
}

