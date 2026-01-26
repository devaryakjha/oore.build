import useSWR, { mutate } from 'swr'
import { apiFetch, fetcher } from './client'
import type {
  GitLabConnectRequest,
  GitLabConnectResponse,
  GitLabSetupRequest,
  GitLabSetupResponse,
  GitLabSetupStatus,
  GitLabCredentials,
  GitLabProjectsResponse,
  GitLabEnableProjectResponse,
} from './types'
import { SETUP_POLLING_INTERVAL } from '@/lib/constants'

const GITLAB_KEY = '/api/gitlab'

export function useGitLabCredentials() {
  return useSWR<GitLabCredentials[]>(`${GITLAB_KEY}/credentials`, fetcher)
}

export function useGitLabProjects(credentialId: string | null, page = 1, perPage = 20) {
  return useSWR<GitLabProjectsResponse>(
    credentialId
      ? `${GITLAB_KEY}/credentials/${credentialId}/projects?page=${page}&per_page=${perPage}`
      : null,
    fetcher
  )
}

export function useGitLabSetupStatus(state: string | null, enabled = true) {
  return useSWR<GitLabSetupStatus>(
    enabled && state ? `${GITLAB_KEY}/setup/status?state=${state}` : null,
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

export async function connectGitLab(data: GitLabConnectRequest = {}): Promise<GitLabConnectResponse> {
  return apiFetch<GitLabConnectResponse>(`${GITLAB_KEY}/connect`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function setupGitLab(data: GitLabSetupRequest = {}): Promise<GitLabSetupResponse> {
  return apiFetch<GitLabSetupResponse>(`${GITLAB_KEY}/setup`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteGitLabCredentials(id: string, force = false): Promise<void> {
  await apiFetch(`${GITLAB_KEY}/credentials/${id}${force ? '?force=true' : ''}`, {
    method: 'DELETE',
  })
  await mutate(`${GITLAB_KEY}/credentials`)
  await mutate('/api/setup/status')
}

export async function refreshGitLabToken(instanceUrl: string): Promise<void> {
  await apiFetch(`${GITLAB_KEY}/refresh?instance_url=${encodeURIComponent(instanceUrl)}`, {
    method: 'POST',
  })
  await mutate(`${GITLAB_KEY}/credentials`)
}

export async function enableGitLabProject(
  projectId: number,
  credentialId: string
): Promise<GitLabEnableProjectResponse> {
  const result = await apiFetch<GitLabEnableProjectResponse>(
    `${GITLAB_KEY}/projects/${projectId}/enable`,
    {
      method: 'POST',
      body: JSON.stringify({ credential_id: credentialId }),
    }
  )
  await mutate(`${GITLAB_KEY}/credentials/${credentialId}/projects`)
  await mutate('/api/repositories')
  return result
}

export async function disableGitLabProject(projectId: number): Promise<void> {
  await apiFetch(`${GITLAB_KEY}/projects/${projectId}`, {
    method: 'DELETE',
  })
  await mutate('/api/repositories')
}

export async function registerGitLabApp(
  instanceUrl: string,
  clientId: string,
  clientSecret: string
): Promise<{ message: string; instance_url: string }> {
  return apiFetch(`${GITLAB_KEY}/apps`, {
    method: 'POST',
    body: JSON.stringify({
      instance_url: instanceUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
}
