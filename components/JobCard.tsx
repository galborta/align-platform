'use client'

import { Database } from '@/types/database'
import ContestJobCard from './ContestJobCard'
import RegularJobCard from './RegularJobCard'

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

  return (
    <RegularJobCard 
      job={job} 
      projectName={projectName}
      tokenSymbol={tokenSymbol}
      applicationCount={applicationCount}
    />
  )
}

