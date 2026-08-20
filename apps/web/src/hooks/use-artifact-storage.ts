import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ConfigureExternalAccessOidcRequest,
  UpdateArtifactStorageSettingsRequest,
  UpdateExternalAccessNetworkSettingsRequest,
  UpdateInstancePreferencesRequest,
  UpdateTrustedProxySettingsRequest,
} from '@oore/client/models'
import {
  configureExternalAccessOidc,
  updateArtifactStorageSettings,
  updateExternalAccessNetworkSettings,
  updateExternalAccessTrustedProxySettings,
  updateInstancePreferences,
} from '@oore/client/operations'
import {
  getArtifactStorageSettingsOptions,
  getArtifactStorageSettingsQueryKey,
  getExternalAccessNetworkSettingsOptions,
  getExternalAccessNetworkSettingsQueryKey,
  getExternalAccessOidcOptions,
  getExternalAccessOidcQueryKey,
  getExternalAccessPreflightOptions,
  getExternalAccessPreflightQueryKey,
  getExternalAccessTrustedProxySettingsOptions,
  getExternalAccessTrustedProxySettingsQueryKey,
  getInstancePreferencesOptions,
  getInstancePreferencesQueryKey,
} from '@oore/client/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import {
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

export function useArtifactStorageSettings() {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getArtifactStorageSettingsOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
    select: (response) => response.settings,
  })
}

export function useUpdateArtifactStorageSettings() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateArtifactStorageSettingsRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateArtifactStorageSettings({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getArtifactStorageSettingsQueryKey({ client }),
        ),
      })
    },
  })
}

export function useInstancePreferences(options?: { enabled?: boolean }) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getInstancePreferencesOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token,
    select: (response) => response.preferences,
  })
}

export function useUpdateInstancePreferences() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateInstancePreferencesRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateInstancePreferences({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getInstancePreferencesQueryKey({ client }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessPreflightQueryKey({ client }),
        ),
      })
    },
  })
}

export function useExternalAccessOidc() {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getExternalAccessOidcOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
  })
}

export function useConfigureExternalAccessOidc() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: ConfigureExternalAccessOidcRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return configureExternalAccessOidc({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessPreflightQueryKey({ client }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessOidcQueryKey({ client }),
        ),
      })
    },
  })
}

export function useExternalAccessPreflight() {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getExternalAccessPreflightOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
  })
}

export function useExternalAccessNetworkSettings(options?: {
  enabled?: boolean
}) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getExternalAccessNetworkSettingsOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token,
    select: (response) => response.settings,
  })
}

export function useUpdateExternalAccessNetworkSettings() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateExternalAccessNetworkSettingsRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateExternalAccessNetworkSettings({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessNetworkSettingsQueryKey({ client }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessPreflightQueryKey({ client }),
        ),
      })
    },
  })
}

export function useExternalAccessTrustedProxySettings() {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getExternalAccessTrustedProxySettingsOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
    select: (response) => response.settings,
  })
}

export function useUpdateExternalAccessTrustedProxySettings() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateTrustedProxySettingsRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateExternalAccessTrustedProxySettings({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessTrustedProxySettingsQueryKey({ client }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getExternalAccessPreflightQueryKey({ client }),
        ),
      })
    },
  })
}
