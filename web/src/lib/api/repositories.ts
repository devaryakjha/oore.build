import useSWR, { mutate } from 'swr'
import { apiFetch, fetcher } from './client'
import type {
  Repository,
  CreateRepositoryRequest,
  UpdateRepositoryRequest,
  WebhookUrlResponse,
} from './types'

const REPOSITORIES_KEY = '/api/repositories'

export function useRepositories() {
  return useSWR<Repository[]>(REPOSITORIES_KEY, fetcher)
}

export function useRepository(id: string | null) {
  return useSWR<Repository>(
    id ? `${REPOSITORIES_KEY}/${id}` : null,
    fetcher
  )
}

export function useWebhookUrl(id: string | null) {
  return useSWR<WebhookUrlResponse>(
    id ? `${REPOSITORIES_KEY}/${id}/webhook-url` : null,
    fetcher
  )
}

export async function createRepository(data: CreateRepositoryRequest): Promise<Repository> {
  const result = await apiFetch<Repository>(REPOSITORIES_KEY, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await mutate(REPOSITORIES_KEY)
  return result
}

export async function updateRepository(
  id: string,
  data: UpdateRepositoryRequest
): Promise<Repository> {
  const result = await apiFetch<Repository>(`${REPOSITORIES_KEY}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  await mutate(REPOSITORIES_KEY)
  await mutate(`${REPOSITORIES_KEY}/${id}`)
  return result
}

export async function deleteRepository(id: string): Promise<void> {
  await apiFetch(`${REPOSITORIES_KEY}/${id}`, {
    method: 'DELETE',
  })
  await mutate(REPOSITORIES_KEY)
}
