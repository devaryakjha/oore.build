import useSWR, { mutate } from 'swr'
import { apiFetch, fetcher } from './client'
import type {
  GitHubAppStatus,
  GitHubManifestResponse,
  GitHubSetupStatus,
  GitHubInstallationsResponse,
  GitHubInstallationRepositoriesResponse,
  GitHubSyncResponse,
} from './types'
import { SETUP_POLLING_INTERVAL } from '@/lib/constants'

const GITHUB_KEY = '/api/github'

export function useGitHubApp() {
  return useSWR<GitHubAppStatus>(`${GITHUB_KEY}/app`, fetcher)
}

export function useGitHubInstallations() {
  return useSWR<GitHubInstallationsResponse>(`${GITHUB_KEY}/installations`, fetcher)
}

export function useGitHubInstallationRepositories(installationId: number | null) {
  return useSWR<GitHubInstallationRepositoriesResponse>(
    installationId ? `${GITHUB_KEY}/installations/${installationId}/repositories` : null,
    fetcher
  )
}

export function useGitHubSetupStatus(state: string | null, enabled = true) {
  return useSWR<GitHubSetupStatus>(
    enabled && state ? `${GITHUB_KEY}/setup/status?state=${state}` : null,
    fetcher,
    {
      refreshInterval: SETUP_POLLING_INTERVAL,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Continue polling even when tab is hidden (critical for auto-close flow)
      refreshWhenHidden: true,
      refreshWhenOffline: false,
    }
  )
}

export async function getGitHubManifest(): Promise<GitHubManifestResponse> {
  return apiFetch<GitHubManifestResponse>(`${GITHUB_KEY}/manifest`)
}

export async function submitGitHubCallback(code: string, state: string): Promise<GitHubAppStatus> {
  return apiFetch<GitHubAppStatus>(`${GITHUB_KEY}/callback`, {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  })
}

export async function syncGitHubInstallations(): Promise<GitHubSyncResponse> {
  const result = await apiFetch<GitHubSyncResponse>(`${GITHUB_KEY}/sync`, {
    method: 'POST',
  })
  await mutate(`${GITHUB_KEY}/app`)
  await mutate(`${GITHUB_KEY}/installations`)
  return result
}

export async function deleteGitHubApp(): Promise<void> {
  await apiFetch(`${GITHUB_KEY}/app?force=true`, {
    method: 'DELETE',
  })
  await mutate(`${GITHUB_KEY}/app`)
  await mutate('/api/setup/status')
}
