import { useQuery } from '@tanstack/react-query'
import { TipToken } from '@/types/database'

/**
 * Response from /api/tokens/user-holdings endpoint
 */
interface TipTokensResponse {
  success: boolean
  tokens: TipToken[]
  projectToken: string | null
}

/**
 * Hook to fetch user's SPL token holdings with USD values
 * 
 * Uses React Query for caching and automatic refetching
 * 
 * @param wallet - User's wallet address (required)
 * @param projectId - Project ID to prioritize project token (optional)
 * 
 * @returns Query result with tokens, loading state, and refetch function
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useTipTokens(
 *   publicKey?.toString(),
 *   projectId  // Optional - omit for direct messages
 * )
 * 
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorMessage />
 * 
 * const tokens = data?.tokens || []
 * ```
 */
export function useTipTokens(
  wallet: string | undefined,
  projectId: string | undefined
) {
  return useQuery<TipTokensResponse>({
    queryKey: ['tip-tokens', wallet, projectId],
    queryFn: async () => {
      if (!wallet) {
        return { success: false, tokens: [], projectToken: null }
      }

      // Build URL with optional projectId
      const url = projectId 
        ? `/api/tokens/user-holdings?wallet=${wallet}&projectId=${projectId}`
        : `/api/tokens/user-holdings?wallet=${wallet}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch tokens')
      }

      return response.json()
    },
    enabled: !!wallet,  // Only wallet is required
    staleTime: 5 * 60 * 1000,      // 5 minutes - data stays fresh
    cacheTime: 30 * 60 * 1000,     // 30 minutes - cache persists in memory
    refetchOnWindowFocus: false,    // Don't refetch when user returns to tab
    retry: 2,                        // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000) // Exponential backoff
  })
}



