import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ConfigureExternalAccessOidcRequest,
  UpdateArtifactStorageSettingsRequest,
  UpdateExternalAccessNetworkSettingsRequest,
  UpdateInstancePreferencesRequest,
  UpdateTrustedProxySettingsRequest,
} from '@/api/types'
import {
  configureExternalAccessOidc,
  getArtifactStorageSettings,
  getExternalAccessNetworkSettings,
  getExternalAccessOidc,
  getExternalAccessPreflight,
  getExternalAccessTrustedProxySettings,
  getInstancePreferences,
  updateArtifactStorageSettings,
  updateExternalAccessNetworkSettings,
  updateExternalAccessTrustedProxySettings,
  updateInstancePreferences,
} from '@/api/instance-settings'
import { useApiContext } from '@/hooks/use-api-context'

export function useArtifactStorageSettings() {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'artifact-storage-settings'],
    queryFn: ({ signal }) =>
      getArtifactStorageSettings({ baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
    select: (response) => response.settings,
  })
}

export function useUpdateArtifactStorageSettings() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateArtifactStorageSettingsRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateArtifactStorageSettings(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'artifact-storage-settings'],
      })
    },
  })
}

export function useInstancePreferences(options?: { enabled?: boolean }) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'instance-preferences'],
    queryFn: ({ signal }) =>
      getInstancePreferences({ baseUrl: baseUrl!, token: token!, signal }),
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token,
    select: (response) => response.preferences,
  })
}

export function useUpdateInstancePreferences() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateInstancePreferencesRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateInstancePreferences(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'instance-preferences'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'external-access-preflight'],
      })
    },
  })
}

export function useExternalAccessOidc() {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'external-access-oidc'],
    queryFn: ({ signal }) =>
      getExternalAccessOidc({ baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
  })
}

export function useConfigureExternalAccessOidc() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: ConfigureExternalAccessOidcRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return configureExternalAccessOidc(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'external-access-preflight'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'external-access-oidc'],
      })
    },
  })
}

export function useExternalAccessPreflight() {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'external-access-preflight'],
    queryFn: ({ signal }) =>
      getExternalAccessPreflight({ baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
  })
}

export function useExternalAccessNetworkSettings(options?: {
  enabled?: boolean
}) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'external-access-network-settings'],
    queryFn: ({ signal }) =>
      getExternalAccessNetworkSettings({
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token,
    select: (response) => response.settings,
  })
}

export function useUpdateExternalAccessNetworkSettings() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateExternalAccessNetworkSettingsRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateExternalAccessNetworkSettings(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'external-access-network-settings',
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'external-access-preflight'],
      })
    },
  })
}

export function useExternalAccessTrustedProxySettings() {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'external-access-trusted-proxy'],
    queryFn: ({ signal }) =>
      getExternalAccessTrustedProxySettings({
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token,
    select: (response) => response.settings,
  })
}

export function useUpdateExternalAccessTrustedProxySettings() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateTrustedProxySettingsRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateExternalAccessTrustedProxySettings(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'external-access-trusted-proxy'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'external-access-preflight'],
      })
    },
  })
}
