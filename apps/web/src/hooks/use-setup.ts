import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { Instance } from '@/lib/types'
import type { OidcConfigureRequest } from '@/lib/api-client/generated/models'
import {
  completeSetup,
  configureOidc,
  getSetupStatus,
  getSetupSummary,
  setupLocalOwnerCreate,
  setupOwnerClaimTrustedProxy,
  setupPreferences,
  verifyBootstrapToken,
} from '@/lib/api-client/generated/endpoints/setup'
import { useActiveInstance } from '@/stores/instance-store'
import { useSetupStore } from '@/stores/setup-store'
import { resolveRequiredInstanceApiBaseUrl } from '@/lib/instance-url'

function requireInstance(instance: Instance | null): string {
  return resolveRequiredInstanceApiBaseUrl(instance)
}

function setupStatusQueryKey(instanceId: string | undefined) {
  return [instanceId ?? '__none__', 'setup-status'] as const
}

function setupSummaryQueryKey(instanceId: string | undefined) {
  return [instanceId ?? '__none__', 'setup-summary'] as const
}

export function setupStatusQueryOptions(instance: Instance | null) {
  return queryOptions({
    queryKey: setupStatusQueryKey(instance?.id),
    queryFn: ({ signal }) =>
      getSetupStatus({ baseUrl: requireInstance(instance), signal }),
    refetchInterval: (query) =>
      query.state.data?.is_configured ? false : 3000,
    enabled: !!instance,
  })
}

export function useSetupStatus() {
  const instance = useActiveInstance()
  return useQuery(setupStatusQueryOptions(instance))
}

export function useVerifyBootstrapToken() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const queryKey = setupStatusQueryKey(instance?.id)

  return useMutation({
    mutationFn: (token: string) =>
      verifyBootstrapToken({ token }, { baseUrl: requireInstance(instance) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useConfigureOidc() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const queryKey = setupStatusQueryKey(instance?.id)
  const summaryQueryKey = setupSummaryQueryKey(instance?.id)

  return useMutation({
    mutationFn: ({
      sessionToken,
      data,
    }: {
      sessionToken: string
      data: OidcConfigureRequest
    }) =>
      configureOidc(data, {
        baseUrl: requireInstance(instance),
        token: sessionToken,
      }),
    onSuccess: (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: summaryQueryKey })
    },
  })
}

export function useSetupLocalOwnerCreate() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const queryKey = setupStatusQueryKey(instance?.id)

  return useMutation({
    mutationFn: ({
      sessionToken,
      email,
    }: {
      sessionToken: string
      email: string
    }) =>
      setupLocalOwnerCreate(
        { email },
        { baseUrl: requireInstance(instance), token: sessionToken },
      ),
    onSuccess: (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useSetupPreferences() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const queryKey = setupStatusQueryKey(instance?.id)

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
      setupPreferences(
        {
          runtime_mode: runtimeMode,
          remote_auth_mode: remoteAuthMode,
        },
        { baseUrl: requireInstance(instance), token: sessionToken },
      ),
    onSuccess: async (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useSetupTrustedProxyClaimOwner() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const queryKey = setupStatusQueryKey(instance?.id)

  return useMutation({
    mutationFn: ({ sessionToken }: { sessionToken: string }) =>
      setupOwnerClaimTrustedProxy({
        baseUrl: requireInstance(instance),
        token: sessionToken,
      }),
    onSuccess: (data) => {
      if (data.session_expires_at) {
        useSetupStore.getState().setSessionExpiresAt(data.session_expires_at)
      }
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useSetupSummary() {
  const instance = useActiveInstance()
  const sessionToken = useSetupStore((s) => s.sessionToken)

  return useQuery({
    queryKey: setupSummaryQueryKey(instance?.id),
    queryFn: ({ signal }) =>
      getSetupSummary({
        baseUrl: requireInstance(instance),
        token: sessionToken!,
        signal,
      }),
    enabled: !!instance && !!sessionToken,
  })
}

export function useCompleteSetup() {
  const queryClient = useQueryClient()
  const instance = useActiveInstance()
  const queryKey = setupStatusQueryKey(instance?.id)

  return useMutation({
    mutationFn: (sessionToken: string) =>
      completeSetup({
        baseUrl: requireInstance(instance),
        token: sessionToken,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}
