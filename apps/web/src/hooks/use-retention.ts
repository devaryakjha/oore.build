import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { UpdateRetentionPolicyRequest } from '@oore/client/models'
import { updateRetentionPolicy } from '@oore/client/operations'
import {
  getRetentionLastCleanupOptions,
  getRetentionLastCleanupQueryKey,
  getRetentionPolicyOptions,
  getRetentionPolicyQueryKey,
} from '@oore/client/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import {
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

export function useRetentionPolicy() {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getRetentionPolicyOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
  })
}

export function useUpdateRetentionPolicy() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: UpdateRetentionPolicyRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateRetentionPolicy({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getRetentionPolicyQueryKey({ client }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getRetentionLastCleanupQueryKey({ client }),
        ),
      })
    },
  })
}

export function useRetentionLastCleanup() {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    getRetentionLastCleanupOptions({ client }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
  })
}
