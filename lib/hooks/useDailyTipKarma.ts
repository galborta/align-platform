import { useQuery } from '@tanstack/react-query'

interface DailyKarmaResponse {
  success: boolean
  dailyKarma: number
  dailyCap: number
  remaining: number
  resetDate: string
}

export function useDailyTipKarma(
  wallet: string | undefined,
  projectId: string | undefined
) {
  return useQuery<DailyKarmaResponse>({
    queryKey: ['daily-tip-karma', wallet, projectId],
    queryFn: async () => {
      if (!wallet || !projectId) {
        return {
          success: false,
          dailyKarma: 0,
          dailyCap: 5000,
          remaining: 5000,
          resetDate: new Date().toISOString().split('T')[0]
        }
      }

      const response = await fetch(
        `/api/karma/daily-tip-status?wallet=${wallet}&projectId=${projectId}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch karma status')
      }

      return response.json()
    },
    enabled: !!wallet && !!projectId,
    staleTime: 1 * 60 * 1000,       // 1 minute
    cacheTime: 5 * 60 * 1000,       // 5 minutes
    refetchInterval: 5 * 60 * 1000,  // Refetch every 5 minutes
    refetchOnWindowFocus: false,
    retry: 1
  })
}

