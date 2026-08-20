import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OoreClient } from '@oore/client/client'
import type { OidcConfigureRequest } from '@oore/client/models'
import {
  completeSetup,
  configureOidc,
  setupLocalOwnerCreate,
  setupOwnerClaimTrustedProxy,
  setupPreferences,
  verifyBootstrapToken,
} from '@oore/client/operations'
import {
  getSetupStatusOptions,
  getSetupStatusQueryKey,
  getSetupSummaryOptions,
  getSetupSummaryQueryKey,
} from '@oore/client/react-query'

import { useActiveInstance } from '@/stores/instance-store'
import { useSetupStore } from '@/stores/setup-store'
import { resolveRequiredInstanceApiBaseUrl } from '@/lib/instance-url'
import type { Instance } from '@/lib/types'
import {
  createWebOoreClient,
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

function setupClient(instance: Instance | null, token?: string): OoreClient {
  return createWebOoreClient({
    baseUrl: instance
      ? resolveRequiredInstanceApiBaseUrl(instance)
      : 'http://127.0.0.1',
    token,
  })
}

function setupStatusQueryKey(instance: Instance | null, client: OoreClient) {
  return scopeOoreQueryKey(
    instance?.id ?? '__none__',
    getSetupStatusQueryKey({ client }),
  )
}

function setupSummaryQueryKey(instance: Instance | null, client: OoreClient) {
  return scopeOoreQueryKey(
    instance?.id ?? '__none__',
    getSetupSummaryQueryKey({ client }),
  )
}

export function setupStatusQueryOptions(instance: Instance | null) {
  const client = setupClient(instance)
  const query = scopeOoreQueryOptions(
    instance?.id ?? '__none__',
    getSetupStatusOptions({ client }),
  )

  return {
    ...query,
    refetchInterval: (query: {
      state: { data?: { is_configured: boolean } }
    }) => (query.state.data?.is_configured ? false : 3000),
    enabled: !!instance,
  }
}

export function useSetupStatus() {
  const instance = useActiveInstance()
  return useQuery(setupStatusQueryOptions(instance))
}

export function useVerifyBootstrapToken() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const client = setupClient(instance)

  return useMutation({
    mutationFn: (token: string) =>
      verifyBootstrapToken({ body: { token }, client }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: setupStatusQueryKey(instance, client),
      })
    },
  })
}

export function useConfigureOidc() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const client = setupClient(instance)

  return useMutation({
    mutationFn: ({
      sessionToken,
      data,
    }: {
      sessionToken: string
      data: OidcConfigureRequest
    }) =>
      configureOidc({
        body: data,
        client: setupClient(instance, sessionToken),
      }),
    onSuccess: (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      void queryClient.invalidateQueries({
        queryKey: setupStatusQueryKey(instance, client),
      })
      void queryClient.invalidateQueries({
        queryKey: setupSummaryQueryKey(instance, client),
      })
    },
  })
}

export function useSetupLocalOwnerCreate() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const client = setupClient(instance)

  return useMutation({
    mutationFn: ({
      sessionToken,
      email,
    }: {
      sessionToken: string
      email: string
    }) =>
      setupLocalOwnerCreate({
        body: { email },
        client: setupClient(instance, sessionToken),
      }),
    onSuccess: (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      void queryClient.invalidateQueries({
        queryKey: setupStatusQueryKey(instance, client),
      })
    },
  })
}

export function useSetupPreferences() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const client = setupClient(instance)

  return useMutation({
    mutationFn: ({
      sessionToken,
      runtimeMode,
      remoteAuthMode,
    }: {
      sessionToken: string
      runtimeMode: 'local' | 'remote'
      remoteAuthMode?: 'oidc' | 'trusted_proxy'
    }) =>
      setupPreferences({
        body: {
          runtime_mode: runtimeMode,
          remote_auth_mode: remoteAuthMode,
        },
        client: setupClient(instance, sessionToken),
      }),
    onSuccess: async (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      await queryClient.invalidateQueries({
        queryKey: setupStatusQueryKey(instance, client),
      })
    },
  })
}

export function useSetupTrustedProxyClaimOwner() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const client = setupClient(instance)

  return useMutation({
    mutationFn: ({ sessionToken }: { sessionToken: string }) =>
      setupOwnerClaimTrustedProxy({
        client: setupClient(instance, sessionToken),
      }),
    onSuccess: (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      void queryClient.invalidateQueries({
        queryKey: setupStatusQueryKey(instance, client),
      })
    },
  })
}

export function useSetupSummary() {
  const instance = useActiveInstance()
  const sessionToken = useSetupStore((state) => state.sessionToken)
  const client = setupClient(instance, sessionToken ?? undefined)
  const query = scopeOoreQueryOptions(
    instance?.id ?? '__none__',
    getSetupSummaryOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!instance && !!sessionToken,
  })
}

export function useCompleteSetup() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const client = setupClient(instance)

  return useMutation({
    mutationFn: (sessionToken: string) =>
      completeSetup({ client: setupClient(instance, sessionToken) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: setupStatusQueryKey(instance, client),
      })
    },
  })
}
