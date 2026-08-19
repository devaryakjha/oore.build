import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  browseLocalGitDirectories,
  checkGitlabPersonalToken as checkGitLabToken,
  deleteIntegration,
  getIntegration,
  gitlabAuthorize,
  gitlabStart,
  listIntegrations,
  listInstallations,
  listRepositories as listIntegrationRepos,
  replaceGitlabPersonalToken as replaceGitLabToken,
  rotateGitlabRepositoryWebhookSecret as rotateGitLabRepositoryWebhookSecret,
  syncInstallations,
} from '@/api/integrations'
import type {
  GitLabAuthorizeRequest,
  GitLabStartRequest,
  ListIntegrationsParams,
  ListIntegrationsResponse,
  ListRepositoriesParams,
  ReplaceGitLabTokenRequest,
} from '@/api/types'
import { useApiContext } from '@/hooks/use-api-context'

export function useIntegrations<TData = ListIntegrationsResponse>(
  params?: ListIntegrationsParams,
  options?: { select?: (data: ListIntegrationsResponse) => TData },
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery<ListIntegrationsResponse, Error, TData>({
    queryKey: [instance?.id ?? '__none__', 'integrations', params ?? {}],
    queryFn: ({ signal }) =>
      listIntegrations(params, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
    select: options?.select,
  })
}

export function useIntegration(id: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'integration', id],
    queryFn: ({ signal }) =>
      getIntegration(id, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token && !!id,
  })
}

export function useInstallations(integrationId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'installations', integrationId],
    queryFn: ({ signal }) =>
      listInstallations(integrationId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token && !!integrationId,
  })
}

export function useIntegrationRepos(
  integrationId: string,
  params?: ListRepositoriesParams,
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'integration-repos',
      integrationId,
      params ?? {},
    ],
    queryFn: ({ signal }) =>
      listIntegrationRepos(integrationId, params, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token && !!integrationId,
  })
}

export function useSyncInstallations() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (integrationId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return syncInstallations(integrationId, {}, { baseUrl, token })
    },
    onSuccess: (_data, integrationId) => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'integration', integrationId],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'installations', integrationId],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'integration-repos',
          integrationId,
        ],
      })
    },
  })
}

export function useGitLabAuthorize() {
  const { baseUrl, token } = useApiContext()

  return useMutation({
    mutationFn: (data: GitLabAuthorizeRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return gitlabAuthorize(data, { baseUrl, token })
    },
    onSuccess: (data) => {
      window.location.href = data.authorize_url
    },
  })
}

export function useGitLabTokenStatus(integrationId: string, enabled: boolean) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'gitlab-token-status',
      integrationId,
    ],
    queryFn: () =>
      checkGitLabToken(integrationId, { baseUrl: baseUrl!, token: token! }),
    enabled: enabled && !!baseUrl && !!token && !!integrationId,
    retry: false,
  })
}

export function useReplaceGitLabToken(integrationId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: ReplaceGitLabTokenRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return replaceGitLabToken(integrationId, data, { baseUrl, token })
    },
    onSuccess: (status) => {
      queryClient.setQueryData(
        [instance?.id ?? '__none__', 'gitlab-token-status', integrationId],
        status,
      )
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'integration', integrationId],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'integrations'],
      })
    },
  })
}

export function useGitLabStart() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: GitLabStartRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return gitlabStart(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'integrations'],
      })
    },
  })
}

export function useRotateGitLabRepositoryWebhookSecret() {
  const { baseUrl, token } = useApiContext()

  return useMutation({
    mutationFn: (repositoryId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return rotateGitLabRepositoryWebhookSecret(repositoryId, {
        baseUrl,
        token,
      })
    },
  })
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (id: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return deleteIntegration(id, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'integrations'],
      })
    },
  })
}

export function useBrowseLocalGitDirectories(path?: string, enabled = true) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'local-git-directory-browser',
      path ?? '__default__',
    ],
    queryFn: ({ signal }) =>
      browseLocalGitDirectories(
        { path },
        { baseUrl: baseUrl!, token: token!, signal },
      ),
    enabled: enabled && !!baseUrl && !!token,
  })
}
