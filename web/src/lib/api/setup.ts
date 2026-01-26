import useSWR from 'swr'
import { fetcher } from './client'
import type { SetupStatus } from './types'

export function useSetupStatus() {
  return useSWR<SetupStatus>('/api/setup/status', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 30000, // Refresh every 30 seconds
  })
}
