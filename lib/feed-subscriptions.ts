/**
 * Feed Subscriptions Manager
 * 
 * Manages all real-time Supabase subscriptions for the Activity Feed.
 * Listens to 10 activity tables and emits events when new activities occur.
 * 
 * Features:
 * - Automatic cleanup on unmount
 * - Debounced event processing (500ms)
 * - Project-level filtering
 * - Memory leak prevention
 * 
 * @see /components/ActivityFeed.tsx for usage
 * @see /lib/feed-queries.ts for initial data fetching
 */

import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

type SubscriptionCallback = (payload: any) => void

interface SubscriptionConfig {
  projectId: string
  onNewActivity: SubscriptionCallback
}

/**
 * FeedSubscriptionManager - Class-based manager for all feed subscriptions
 * 
 * Manages lifecycle of 10 real-time subscriptions for activity feed.
 * Handles event queuing, debouncing, and cleanup.
 * 
 * @example
 * ```typescript
 * const manager = new FeedSubscriptionManager({
 *   projectId: 'project-uuid',
 *   onNewActivity: (event) => console.log('New activity:', event)
 * })
 * 
 * const unsubscribe = manager.subscribe()
 * 
 * // Later, cleanup
 * unsubscribe()
 * ```
 */
export class FeedSubscriptionManager {
  private channels: RealtimeChannel[] = []
  private projectId: string
  private onNewActivity: SubscriptionCallback
  private eventQueue: any[] = []
  private processTimeout: NodeJS.Timeout | null = null
  
  constructor(config: SubscriptionConfig) {
    this.projectId = config.projectId
    this.onNewActivity = config.onNewActivity
  }
  
  /**
   * Setup all subscriptions
   * 
   * Creates 10 real-time channels for all activity tables.
   * Returns cleanup function to call on component unmount.
   * 
   * @returns Unsubscribe function
   */
  subscribe(): () => void {
    console.log('🔔 Setting up feed subscriptions for project:', this.projectId)
    
    // Subscribe to all activity tables
    this.subscribeToJobs()
    this.subscribeToJobApplications()
    this.subscribeToJobApplicationVotes()
    this.subscribeToJobComments()
    this.subscribeToJobSubmissions()
    this.subscribeToJobDisputes()
    this.subscribeToFeedEvents() // For revision events and other custom feed events
    this.subscribeToPendingAssets()
    this.subscribeToAssetVotes()
    this.subscribeToChatTips()
    this.subscribeToWalletKarma()
    
    // Return cleanup function
    return () => this.unsubscribe()
  }
  
  /**
   * Cleanup all subscriptions
   * 
   * Removes all channels and clears event queue.
   * Prevents memory leaks.
   */
  unsubscribe(): void {
    console.log('🔕 Cleaning up feed subscriptions')
    
    this.channels.forEach(channel => {
      supabase.removeChannel(channel)
    })
    this.channels = []
    
    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
    }
  }
  
  /**
   * Queue event and process after debounce
   * 
   * Prevents feed spam by batching rapid events.
   * Waits 500ms after last event before processing queue.
   * 
   * @param event - Activity event to queue
   */
  private queueEvent(event: any): void {
    this.eventQueue.push(event)
    
    // Debounce: wait 500ms before processing
    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
    }
    
    this.processTimeout = setTimeout(() => {
      this.processQueue()
    }, 500)
  }
  
  /**
   * Process all queued events
   * 
   * Sends all queued events to callback and clears queue.
   */
  private processQueue(): void {
    if (this.eventQueue.length === 0) return
    
    const events = [...this.eventQueue]
    this.eventQueue = []
    
    events.forEach(event => {
      this.onNewActivity(event)
    })
  }
  
  /**
   * Subscribe to jobs table
   * 
   * Listens for:
   * - INSERT: New job posted
   * - UPDATE: Job completed or assigned
   */
  private subscribeToJobs(): void {
    const channel = supabase
      .channel(`feed_jobs_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          console.log('📋 New job:', payload.new)
          this.queueEvent({
            type: 'job_posted',
            table: 'jobs',
            data: payload.new
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          // Detect job completion
          const newData = payload.new as any
          const oldData = payload.old as any
          
          if (newData.status === 'completed' && oldData.status !== 'completed') {
            console.log('✅ Job completed:', newData)
            this.queueEvent({
              type: 'job_completed',
              table: 'jobs',
              data: newData
            })
          }
          
          // Detect job assignment
          if (newData.assigned_to && !oldData.assigned_to) {
            console.log('👷 Job assigned:', newData)
            this.queueEvent({
              type: 'job_assigned',
              table: 'jobs',
              data: newData
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to job_applications table
   * 
   * Listens for:
   * - INSERT: New application submitted
   */
  private subscribeToJobApplications(): void {
    const channel = supabase
      .channel(`feed_applications_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications'
        },
        async (payload) => {
          // Verify this application belongs to our project
          const application = payload.new as any
          const { data: job } = await supabase
            .from('jobs')
            .select('id, title, project_id')
            .eq('id', application.job_id)
            .single()
          
          if (job?.project_id === this.projectId) {
            console.log('📝 New application:', application)
            this.queueEvent({
              type: 'job_applied',
              table: 'job_applications',
              data: { ...application, job }
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to job_application_votes table
   * 
   * Listens for:
   * - INSERT: New vote on application
   */
  private subscribeToJobApplicationVotes(): void {
    const channel = supabase
      .channel(`feed_app_votes_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_application_votes'
        },
        async (payload) => {
          const vote = payload.new as any
          
          // Fetch application + job data
          const { data: application } = await supabase
            .from('job_applications')
            .select(`
              id,
              applicant_wallet,
              job:jobs!inner(id, title, project_id)
            `)
            .eq('id', vote.application_id)
            .single()
          
          if (application?.job?.project_id === this.projectId) {
            console.log('👍 New application vote:', vote)
            this.queueEvent({
              type: 'job_application_upvoted',
              table: 'job_application_votes',
              data: { ...vote, application }
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to job_comments table
   * 
   * Listens for:
   * - INSERT: New comment on job
   */
  private subscribeToJobComments(): void {
    const channel = supabase
      .channel(`feed_comments_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_comments'
        },
        async (payload) => {
          const comment = payload.new as any
          
          // Fetch job data
          const { data: job } = await supabase
            .from('jobs')
            .select('id, title, project_id')
            .eq('id', comment.job_id)
            .single()
          
          if (job?.project_id === this.projectId) {
            console.log('💬 New comment:', comment)
            this.queueEvent({
              type: 'job_comment',
              table: 'job_comments',
              data: { ...comment, job }
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to job_submissions table
   * 
   * Listens for:
   * - INSERT: Work submitted for job
   */
  private subscribeToJobSubmissions(): void {
    const channel = supabase
      .channel(`feed_submissions_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_submissions'
        },
        async (payload) => {
          const submission = payload.new as any
          
          // Fetch job data
          const { data: job } = await supabase
            .from('jobs')
            .select('id, title, project_id')
            .eq('id', submission.job_id)
            .single()
          
          if (job?.project_id === this.projectId) {
            console.log('📤 New submission:', submission)
            this.queueEvent({
              type: 'job_submitted',
              table: 'job_submissions',
              data: { ...submission, job }
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to job_disputes table
   * 
   * Listens for:
   * - INSERT: New dispute opened
   */
  private subscribeToJobDisputes(): void {
    const channel = supabase
      .channel(`feed_disputes_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_disputes'
        },
        async (payload) => {
          const dispute = payload.new as any
          
          // Fetch job data
          const { data: job } = await supabase
            .from('jobs')
            .select('id, title, project_id, poster_wallet, assigned_to')
            .eq('id', dispute.job_id)
            .single()
          
          if (job?.project_id === this.projectId) {
            console.log('⚖️ New dispute:', dispute)
            this.queueEvent({
              type: 'job_disputed',
              table: 'job_disputes',
              data: { ...dispute, job }
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to pending_assets table
   * 
   * Listens for:
   * - INSERT: New asset submitted
   * - UPDATE: Asset verified, backed, or hidden
   */
  private subscribeToPendingAssets(): void {
    const channel = supabase
      .channel(`feed_assets_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_assets',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          console.log('🎨 New asset:', payload.new)
          this.queueEvent({
            type: 'asset_submitted',
            table: 'pending_assets',
            data: payload.new
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_assets',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          const newData = payload.new as any
          const oldData = payload.old as any
          
          // Detect verification
          if (newData.verification_status === 'verified' && oldData.verification_status !== 'verified') {
            console.log('✅ Asset verified:', newData)
            this.queueEvent({
              type: 'asset_verified',
              table: 'pending_assets',
              data: newData
            })
          }
          
          // Detect backing threshold
          if (newData.verification_status === 'backed' && oldData.verification_status !== 'backed') {
            console.log('⭐ Asset backed:', newData)
            this.queueEvent({
              type: 'asset_backed',
              table: 'pending_assets',
              data: newData
            })
          }
          
          // Detect hiding
          if (newData.verification_status === 'hidden' && oldData.verification_status !== 'hidden') {
            console.log('🙈 Asset hidden:', newData)
            this.queueEvent({
              type: 'asset_hidden',
              table: 'pending_assets',
              data: newData
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to asset_votes table
   * 
   * Listens for:
   * - INSERT: New upvote on asset (reports ignored)
   */
  private subscribeToAssetVotes(): void {
    const channel = supabase
      .channel(`feed_asset_votes_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'asset_votes'
        },
        async (payload) => {
          const vote = payload.new as any
          
          // Only track upvotes (not reports)
          if (vote.vote_type !== 'upvote') return
          
          // Fetch asset data
          const { data: asset } = await supabase
            .from('pending_assets')
            .select('id, asset_type, asset_data, project_id')
            .eq('id', vote.pending_asset_id)
            .single()
          
          if (asset?.project_id === this.projectId) {
            console.log('👍 New asset vote:', vote)
            this.queueEvent({
              type: 'asset_upvoted',
              table: 'asset_votes',
              data: { ...vote, asset }
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to chat_tips table
   * 
   * Listens for:
   * - INSERT: New public tip sent
   */
  private subscribeToChatTips(): void {
    const channel = supabase
      .channel(`feed_tips_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_tips',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          const tip = payload.new as any
          
          // Only show public tips in feed
          if (tip.is_public) {
            console.log('💰 New tip:', tip)
            this.queueEvent({
              type: 'tip_sent',
              table: 'chat_tips',
              data: tip
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
  
  /**
   * Subscribe to wallet_karma table
   * 
   * Listens for:
   * - UPDATE: Karma milestone crossed
   */
  private subscribeToWalletKarma(): void {
    const channel = supabase
      .channel(`feed_karma_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallet_karma',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          const newData = payload.new as any
          const oldData = payload.old as any
          
          // Detect milestone crossings
          const milestones = [1000, 5000, 10000, 50000, 100000]
          
          milestones.forEach(milestone => {
            if (newData.total_karma_points >= milestone && oldData.total_karma_points < milestone) {
              console.log('🏆 Karma milestone:', milestone, newData.wallet_address)
              this.queueEvent({
                type: 'karma_milestone',
                table: 'wallet_karma',
                data: { ...newData, milestone }
              })
            }
          })
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }

  /**
   * Subscribe to feed_events table
   * 
   * Listens for:
   * - INSERT: New custom feed events (revision requests, submissions, etc.)
   */
  private subscribeToFeedEvents(): void {
    const channel = supabase
      .channel(`feed_events_${this.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_events',
          filter: `project_id=eq.${this.projectId}`
        },
        (payload) => {
          const feedEvent = payload.new as any
          
          // Only process revision-related events (others are handled by their native tables)
          const revisionEventTypes = ['job_revision_requested', 'job_revision_submitted']
          
          if (revisionEventTypes.includes(feedEvent.event_type)) {
            console.log('🔄 Revision event:', feedEvent.event_type, feedEvent.id)
            this.queueEvent({
              type: feedEvent.event_type,
              table: 'feed_events',
              data: feedEvent
            })
          }
        }
      )
      .subscribe()
    
    this.channels.push(channel)
  }
}

/**
 * Helper function to setup subscriptions
 * 
 * Convenience wrapper around FeedSubscriptionManager class.
 * 
 * @param projectId - Project UUID to subscribe to
 * @param onNewActivity - Callback for new activities
 * @returns Unsubscribe function
 * 
 * @example
 * ```typescript
 * const unsubscribe = setupFeedSubscriptions(
 *   'project-uuid',
 *   (event) => {
 *     console.log('New activity:', event.type)
 *     // Transform and add to feed
 *   }
 * )
 * 
 * // Later, cleanup
 * unsubscribe()
 * ```
 */
export function setupFeedSubscriptions(
  projectId: string,
  onNewActivity: SubscriptionCallback
): () => void {
  const manager = new FeedSubscriptionManager({ projectId, onNewActivity })
  return manager.subscribe()
}

