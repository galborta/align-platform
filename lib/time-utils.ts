/**
 * Time Calculation Utilities
 * 
 * Helper functions for calculating and formatting time-related values
 * across the application, particularly for campaign deadlines and countdowns.
 */

export interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  total_hours: number
  hasEnded: boolean
}

/**
 * Calculate time remaining until a specific date
 * 
 * @param endDate - The target end date
 * @returns Object containing days, hours, minutes, and status
 * 
 * @example
 * ```typescript
 * const deadline = new Date('2026-01-10T12:00:00Z')
 * const remaining = calculateTimeRemaining(deadline)
 * console.log(remaining.days) // 5
 * console.log(remaining.hours) // 14
 * console.log(remaining.hasEnded) // false
 * ```
 */
export function calculateTimeRemaining(endDate: Date): TimeRemaining {
  const now = new Date()
  const diff = endDate.getTime() - now.getTime()
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, total_hours: 0, hasEnded: true }
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const total_hours = Math.floor(diff / (1000 * 60 * 60))
  
  return { days, hours, minutes, total_hours, hasEnded: false }
}

/**
 * Format time remaining into human-readable string
 * 
 * @param time - TimeRemaining object from calculateTimeRemaining
 * @returns Formatted string like "5 days 14 hours remaining"
 * 
 * @example
 * ```typescript
 * const time = calculateTimeRemaining(deadline)
 * const formatted = formatTimeRemaining(time)
 * // "5 days 14 hours remaining"
 * // "1 day 8 hours remaining"
 * // "8 hours remaining"
 * // "30 minutes remaining"
 * // "Campaign ended"
 * ```
 */
export function formatTimeRemaining(time: TimeRemaining): string {
  if (time.hasEnded) return 'Campaign ended'
  
  if (time.days > 1) {
    return `${time.days} days ${time.hours} hours remaining`
  }
  
  if (time.days === 1) {
    return `1 day ${time.hours} hours remaining`
  }
  
  if (time.hours > 1) {
    return `${time.hours} hours remaining`
  }
  
  if (time.hours === 1) {
    return `1 hour ${time.minutes} minutes remaining`
  }
  
  return `${time.minutes} minutes remaining`
}

/**
 * Check if a deadline is urgent (less than 24 hours)
 * 
 * @param endDate - The deadline to check
 * @returns true if less than 24 hours remaining
 * 
 * @example
 * ```typescript
 * if (isDeadlineUrgent(campaignEnd)) {
 *   console.log('Hurry! Campaign ending soon!')
 * }
 * ```
 */
export function isDeadlineUrgent(endDate: Date): boolean {
  const remaining = calculateTimeRemaining(endDate)
  return !remaining.hasEnded && remaining.total_hours < 24
}

/**
 * Get countdown timer color based on urgency
 * 
 * @param endDate - The deadline to check
 * @returns Color code for UI display
 * 
 * @example
 * ```typescript
 * const color = getDeadlineColor(campaignEnd)
 * // Returns: 'var(--text-muted, #A3A7B5)' if ended
 * // Returns: '#EF4444' if urgent
 * // Returns: 'var(--text-primary, #1A1A1E)' if normal
 * ```
 */
export function getDeadlineColor(endDate: Date): string {
  const remaining = calculateTimeRemaining(endDate)
  
  if (remaining.hasEnded) {
    return 'var(--text-muted, #A3A7B5)'
  }
  
  if (remaining.total_hours < 24) {
    return '#EF4444' // Red for urgent
  }
  
  return 'var(--text-primary, #1A1A1E)'
}

/**
 * Calculate percentage of time elapsed
 * Useful for progress bars
 * 
 * @param startDate - Campaign start date
 * @param endDate - Campaign end date
 * @returns Percentage (0-100) of time elapsed
 * 
 * @example
 * ```typescript
 * const progress = calculateTimeProgress(startDate, endDate)
 * console.log(progress) // 75 (75% complete)
 * ```
 */
export function calculateTimeProgress(startDate: Date, endDate: Date): number {
  const now = new Date()
  const total = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  
  if (elapsed <= 0) return 0
  if (elapsed >= total) return 100
  
  return Math.round((elapsed / total) * 100)
}

