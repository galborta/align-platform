/**
 * Environment Filtering Utilities
 * 
 * Prevents localhost test data from appearing in production by:
 * 1. Tagging records with 'production' or 'development' environment
 * 2. Filtering queries based on NODE_ENV
 * 3. Providing optional "Publish to Production" override on localhost
 * 
 * Usage:
 * 
 * // When creating records (API routes):
 * const environment = getEnvironment(forceProduction)
 * await supabase.from('jobs').insert({ ...data, environment })
 * 
 * // When querying records (anywhere):
 * const { data } = await supabase
 *   .from('jobs')
 *   .select('*')
 *   .match(getEnvironmentFilter())
 * 
 * // In forms (to show checkbox):
 * {isLocalhost() && (
 *   <Checkbox 
 *     label="Publish to Production"
 *     checked={publishToProduction}
 *     onChange={(e) => setPublishToProduction(e.target.checked)}
 *   />
 * )}
 */

/**
 * Returns the appropriate environment tag for new records
 * 
 * @param forceProduction - Optional override to create production record from localhost
 * @returns 'production' or 'development'
 * 
 * Logic:
 * - If forceProduction=true → 'production' (user explicitly wants prod data)
 * - If NODE_ENV='production' → 'production' (always prod in production)
 * - Otherwise → 'development' (localhost test data)
 */
export const getEnvironment = (forceProduction?: boolean): 'production' | 'development' => {
  // If user explicitly wants production data, honor it
  if (forceProduction) {
    return 'production'
  }
  
  // In production environment, always create production data
  if (process.env.NODE_ENV === 'production') {
    return 'production'
  }
  
  // On localhost, default to development unless overridden
  return 'development'
}

/**
 * Returns Supabase filter object for environment-based queries
 * 
 * @returns Filter object to use with .match() or spread into query
 * 
 * Logic:
 * - Production: Returns { environment: 'production' } (only show prod data)
 * - Localhost: Returns {} (show all data for testing/debugging)
 * 
 * Example:
 * ```typescript
 * const { data } = await supabase
 *   .from('jobs')
 *   .select('*')
 *   .match(getEnvironmentFilter()) // Automatically filters based on NODE_ENV
 *   .eq('status', 'open')
 * ```
 */
export const getEnvironmentFilter = (): { environment?: 'production' } => {
  // In production, only show production data
  if (process.env.NODE_ENV === 'production') {
    return { environment: 'production' }
  }
  
  // On localhost, show everything (both dev and prod) for testing
  return {}
}

/**
 * Checks if code is running on localhost (development environment)
 * 
 * @returns true if localhost, false if production
 * 
 * Use this to conditionally render the "Publish to Production" checkbox:
 * 
 * ```typescript
 * {isLocalhost() && (
 *   <FormControlLabel
 *     control={<Checkbox checked={publishToProduction} onChange={...} />}
 *     label="Publish to Production (visible on live site)"
 *   />
 * )}
 * ```
 */
export const isLocalhost = (): boolean => {
  return process.env.NODE_ENV !== 'production'
}

/**
 * Type definition for environment values
 */
export type Environment = 'production' | 'development'

/**
 * Helper to validate environment string
 */
export const isValidEnvironment = (env: string): env is Environment => {
  return env === 'production' || env === 'development'
}
