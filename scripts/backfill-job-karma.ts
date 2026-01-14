/**
 * Backfill Job Karma Script
 * Awards karma to workers and posters who completed jobs before karma system was integrated
 * 
 * This script:
 * 1. Finds all paid job submissions (social_payment_released = true)
 * 2. Awards workers karma based on USD value (USD × 10)
 * 3. Awards posters karma based on USD value (USD × 5)
 * 4. Increments completion counters
 * 
 * Safe to run multiple times (uses increment, not set)
 * 
 * Usage:
 *   npm run backfill-karma
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

// Load environment variables - try .env.local first, then .env
config({ path: '.env.local' })
config({ path: '.env' })

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface JobSubmission {
  id: string
  worker_wallet: string
  social_payment_amount_usd: number | null
  jobs: {
    id: string
    project_id: string
    poster_wallet: string
    title: string
  } | null
}

async function backfillJobKarma() {
  console.log('🚀 Starting job karma backfill...\n')
  
  // Find all paid submissions
  const { data: submissions, error } = await supabase
    .from('job_submissions')
    .select(`
      id,
      worker_wallet,
      social_payment_amount_usd,
      jobs!inner (
        id,
        project_id,
        poster_wallet,
        title
      )
    `)
    .eq('social_payment_released', true)
    .not('social_payment_amount_usd', 'is', null) as { data: JobSubmission[] | null, error: any }
  
  if (error) {
    console.error('❌ Error fetching submissions:', error)
    return
  }
  
  if (!submissions || submissions.length === 0) {
    console.log('✅ No paid submissions found to backfill')
    return
  }
  
  console.log(`📊 Found ${submissions.length} paid submissions to backfill\n`)
  
  let workersProcessed = 0
  let workersSkipped = 0
  let workersFailed = 0
  const postersProcessed = new Set<string>()
  const postersFailed = new Set<string>()
  
  // Group submissions by job to handle poster karma correctly
  const submissionsByJob = new Map<string, JobSubmission[]>()
  for (const submission of submissions) {
    if (!submission.jobs) continue
    const jobId = submission.jobs.id
    if (!submissionsByJob.has(jobId)) {
      submissionsByJob.set(jobId, [])
    }
    submissionsByJob.get(jobId)!.push(submission)
  }
  
  console.log(`📦 Processing ${submissionsByJob.size} unique jobs\n`)
  
  // Process each job
  for (const [jobId, jobSubmissions] of submissionsByJob) {
    const firstSubmission = jobSubmissions[0]
    if (!firstSubmission.jobs) continue
    
    const job = firstSubmission.jobs
    console.log(`\n🔄 Job: "${job.title}" (${jobId.slice(0, 8)}...)`)
    
    // Process all submissions for this job
    for (const submission of jobSubmissions) {
      const usdAmount = submission.social_payment_amount_usd || 0
      const workerKarma = Math.floor(usdAmount * 10)
      
      if (workerKarma === 0) {
        console.log(`  ⚠️  Worker ${submission.worker_wallet.slice(0,8)}... - $0 payment, skipping`)
        workersSkipped++
        continue
      }
      
      try {
        // Award worker karma (USD × 10)
        await supabase.rpc('increment_karma_field_by_amount_for_project', {
          p_wallet_address: submission.worker_wallet,
          p_project_id: job.project_id,
          p_field_name: 'total_karma_points',
          p_amount: workerKarma
        })
        
        // Increment jobs completed counter
        await supabase.rpc('increment_karma_field_by_amount_for_project', {
          p_wallet_address: submission.worker_wallet,
          p_project_id: job.project_id,
          p_field_name: 'jobs_completed_as_worker_count',
          p_amount: 1
        })
        
        workersProcessed++
        console.log(`  ✅ Worker ${submission.worker_wallet.slice(0,8)}... +${workerKarma} karma ($${usdAmount} job)`)
      } catch (err) {
        console.error(`  ❌ Failed to award worker karma:`, err)
        workersFailed++
      }
    }
    
    // Award poster karma once per job (sum of all submissions)
    if (!postersProcessed.has(jobId)) {
      const totalUsdPaid = jobSubmissions.reduce((sum, s) => sum + (s.social_payment_amount_usd || 0), 0)
      const posterKarma = Math.floor(totalUsdPaid * 5)
      
      if (posterKarma > 0) {
        try {
          // Award poster karma (USD × 5)
          await supabase.rpc('increment_karma_field_by_amount_for_project', {
            p_wallet_address: job.poster_wallet,
            p_project_id: job.project_id,
            p_field_name: 'total_karma_points',
            p_amount: posterKarma
          })
          
          // Increment jobs posted counter
          await supabase.rpc('increment_karma_field_by_amount_for_project', {
            p_wallet_address: job.poster_wallet,
            p_project_id: job.project_id,
            p_field_name: 'jobs_posted_as_poster_count',
            p_amount: 1
          })
          
          postersProcessed.add(jobId)
          console.log(`  ✅ Poster ${job.poster_wallet.slice(0,8)}... +${posterKarma} karma ($${totalUsdPaid.toFixed(2)} total paid)`)
        } catch (err) {
          console.error(`  ❌ Failed to award poster karma:`, err)
          postersFailed.add(jobId)
        }
      } else {
        console.log(`  ⚠️  Poster ${job.poster_wallet.slice(0,8)}... - $0 total, skipping`)
      }
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('✨ Backfill complete!\n')
  console.log('📊 Summary:')
  console.log(`   Workers:`)
  console.log(`     ✅ Processed: ${workersProcessed}`)
  console.log(`     ⚠️  Skipped:   ${workersSkipped}`)
  console.log(`     ❌ Failed:    ${workersFailed}`)
  console.log(`   Posters:`)
  console.log(`     ✅ Processed: ${postersProcessed.size}`)
  console.log(`     ❌ Failed:    ${postersFailed.size}`)
  console.log('='.repeat(60) + '\n')
  
  if (workersFailed > 0 || postersFailed.size > 0) {
    console.log('⚠️  Some karma awards failed. Check errors above.')
    process.exit(1)
  } else {
    console.log('🎉 All karma awards successful!')
  }
}

// Run the backfill
backfillJobKarma()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
