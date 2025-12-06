/**
 * Feed Navigation Library
 * 
 * Generates deep link URLs for all feed activity types.
 * Supports hash fragments for scroll-to-section navigation.
 * 
 * @see /types/feed.ts for FeedItem type definitions
 * @see /components/FeedItem.tsx for usage
 */

import { FeedItem } from '@/types/feed'

/**
 * Deep link configuration for feed item navigation
 */
export interface DeepLinkConfig {
  url: string
  openInNewTab?: boolean
  scrollTo?: string // Element ID or section name for hash fragment
}

/**
 * Generate deep link URL for a feed activity
 * 
 * Returns null for non-navigable activities (e.g., tips that open modals).
 * Includes hash fragments for scroll-to-section when applicable.
 * 
 * @param item - Feed item to generate link for
 * @param projectId - UUID of the project (required for most routes)
 * @returns DeepLinkConfig with URL and navigation metadata, or null if not navigable
 * 
 * @example
 * ```typescript
 * const jobItem: FeedItem = {
 *   id: 'test',
 *   type: 'job_applied',
 *   timestamp: new Date(),
 *   data: { jobId: 'job-123' }
 * }
 * 
 * const link = getDeepLink(jobItem, 'project-456')
 * // Returns: { 
 * //   url: '/project/project-456/jobs/job-123', 
 * //   scrollTo: 'applications',
 * //   openInNewTab: false
 * // }
 * ```
 */
export function getDeepLink(item: FeedItem, projectId: string): DeepLinkConfig | null {
  const { type, data } = item
  
  // Handle missing or invalid data
  if (!data) {
    console.warn('Feed item missing data:', item)
    return null
  }

  switch (type) {
    // ==================== JOB ACTIVITIES ====================
    
    case 'job_posted':
    case 'job_assigned':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false
      }
    
    case 'job_applied':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'applications'
      }
    
    case 'job_application_upvoted':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'applications'
      }
    
    case 'job_comment':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'comments'
      }
    
    case 'job_submitted':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'submission'
      }
    
    case 'job_completed':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false
      }
    
    case 'job_disputed':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'dispute'
      }
    
    // ==================== REVISION ACTIVITIES ====================
    
    case 'job_revision_requested':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'comments' // Revision requests appear in comments
      }
    
    case 'job_revision_submitted':
      if (!data.jobId) return null
      return {
        url: `/project/${projectId}/jobs/${data.jobId}`,
        openInNewTab: false,
        scrollTo: 'submission' // Scroll to latest submission
      }
    
    // ==================== ASSET ACTIVITIES ====================
    
    case 'asset_submitted':
    case 'asset_upvoted':
    case 'asset_backed':
    case 'asset_hidden':
      // Navigate to project page, scroll to community curation section
      return {
        url: `/project/${projectId}`,
        openInNewTab: false,
        scrollTo: 'community-curation'
      }
    
    case 'asset_verified':
      // Navigate to project page, scroll to verified assets section
      return {
        url: `/project/${projectId}`,
        openInNewTab: false,
        scrollTo: 'social-assets'
      }
    
    // ==================== COMMUNITY ACTIVITIES ====================
    
    // Tip Activities - no direct navigation, will open modal instead
    case 'tip_sent':
      // Tips should open UserProfileView modal for recipient
      // Return null here, parent component will handle modal
      return null
    
    // Karma Milestones - navigate to user profile page
    case 'karma_milestone':
      if (!data.wallet) return null
      return {
        url: `/profile/${data.wallet}/jobs`,
        openInNewTab: true // Open profiles in new tab
      }
    
    default:
      console.warn('Unknown activity type for deep link:', type)
      return null
  }
}

/**
 * Build full URL with hash fragment for scroll-to-section
 * 
 * @param url - Base URL path
 * @param scrollTo - Optional element ID or section name
 * @returns Complete URL with hash fragment if scrollTo provided
 * 
 * @example
 * ```typescript
 * buildUrlWithHash('/project/123/jobs/456', 'comments')
 * // Returns: '/project/123/jobs/456#comments'
 * ```
 */
export function buildUrlWithHash(url: string, scrollTo?: string): string {
  if (!scrollTo) return url
  return `${url}#${scrollTo}`
}

/**
 * Scroll to element after navigation with visual highlight
 * 
 * Waits for specified delay (to allow page to load), then scrolls
 * to element and briefly highlights it with lime tint.
 * 
 * @param elementId - DOM element ID to scroll to
 * @param delay - Delay in ms before scrolling (default: 300ms)
 * 
 * @example
 * ```typescript
 * // After navigation, scroll to comments section
 * useEffect(() => {
 *   if (window.location.hash === '#comments') {
 *     scrollToElement('comments')
 *   }
 * }, [])
 * ```
 */
export function scrollToElement(elementId: string, delay: number = 300): void {
  setTimeout(() => {
    const element = document.getElementById(elementId)
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      })
      // Highlight element briefly with lime tint
      element.style.transition = 'background-color 0.3s'
      element.style.backgroundColor = '#E3F06F33' // Lime with 20% opacity
      setTimeout(() => {
        element.style.backgroundColor = ''
      }, 2000)
    } else {
      console.warn('Element not found for scroll:', elementId)
    }
  }, delay)
}

/**
 * Get activity type color for UI elements
 * 
 * Returns hex color code based on activity category:
 * - Job activities: Purple (#7C4DFF)
 * - Asset activities: Blue (#2196F3)
 * - Tips: Lime (#CDDC39)
 * - Karma: Orange (#FF9800)
 * 
 * @param type - Activity type string
 * @returns Hex color code
 */
export function getActivityColor(type: string): string {
  if (type.startsWith('job_')) return '#7C4DFF' // Purple
  if (type.startsWith('asset_')) return '#2196F3' // Blue
  if (type === 'tip_sent') return '#CDDC39' // Lime
  if (type === 'karma_milestone') return '#FF9800' // Orange
  return '#757575' // Gray fallback
}

/**
 * Check if feed item is navigable (has a URL destination)
 * 
 * @param item - Feed item to check
 * @param projectId - Project UUID
 * @returns true if item can be navigated to
 */
export function isNavigable(item: FeedItem, projectId: string): boolean {
  return getDeepLink(item, projectId) !== null
}

/**
 * Get navigation cursor style based on navigability
 * 
 * @param item - Feed item to check
 * @param projectId - Project UUID
 * @returns CSS cursor value ('pointer' or 'default')
 */
export function getNavigationCursor(item: FeedItem, projectId: string): string {
  // Batched items always clickable (opens modal)
  if (item.batchedCount && item.batchedCount > 1) {
    return 'pointer'
  }
  
  // Check if item has deep link
  return isNavigable(item, projectId) ? 'pointer' : 'default'
}

/**
 * Extract project ID from various feed item data structures
 * 
 * Some feed items store projectId directly, others have it nested.
 * This helper extracts it consistently.
 * 
 * @param item - Feed item
 * @returns Project UUID or null if not found
 */
export function extractProjectId(item: FeedItem): string | null {
  const { data } = item
  
  // Direct projectId field
  if (data.projectId) return data.projectId
  
  // Nested in job object
  if (data.job?.project_id) return data.job.project_id
  
  // Nested in asset object
  if (data.asset?.project_id) return data.asset.project_id
  
  return null
}






