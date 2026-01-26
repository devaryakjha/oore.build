import useSWR, { mutate } from 'swr'
import { apiFetch, fetcher } from './client'
import type { Build, TriggerBuildRequest } from './types'
import { BUILD_POLLING_INTERVAL } from '@/lib/constants'

const BUILDS_KEY = '/api/builds'

export function useBuilds(repositoryId?: string) {
  const key = repositoryId
    ? `${BUILDS_KEY}?repo=${repositoryId}`
    : BUILDS_KEY

  return useSWR<Build[]>(key, fetcher)
}

export function useBuild(id: string | null, poll = false) {
  return useSWR<Build>(
    id ? `${BUILDS_KEY}/${id}` : null,
    fetcher,
    {
      refreshInterval: poll ? BUILD_POLLING_INTERVAL : 0,
    }
  )
}

export function useRecentBuilds(limit = 5) {
  const { data, ...rest } = useBuilds()

  // Sort by created_at desc and take first `limit`
  const recentBuilds = data
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  return { data: recentBuilds, ...rest }
}

export async function triggerBuild(
  repositoryId: string,
  data: TriggerBuildRequest = {}
): Promise<Build> {
  const result = await apiFetch<Build>(`/api/repositories/${repositoryId}/trigger`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await mutate(BUILDS_KEY)
  return result
}

export async function cancelBuild(id: string): Promise<void> {
  await apiFetch(`${BUILDS_KEY}/${id}/cancel`, {
    method: 'POST',
  })
  await mutate(BUILDS_KEY)
  await mutate(`${BUILDS_KEY}/${id}`)
}
