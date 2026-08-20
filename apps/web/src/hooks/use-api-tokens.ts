import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CreateApiTokenRequest,
  ListApiTokensData,
} from '@oore/client/models'
import { createApiToken, revokeApiToken } from '@oore/client/operations'
import {
  listApiTokensOptions,
  listApiTokensQueryKey,
} from '@oore/client/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import {
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

type ListApiTokensParams = NonNullable<ListApiTokensData['query']>

export function useApiTokens(params?: ListApiTokensParams) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    listApiTokensOptions({ client, query: params }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
  })
}

export function useCreateApiToken() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: CreateApiTokenRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return createApiToken({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listApiTokensQueryKey({ client }),
        ),
      })
    },
  })
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (tokenId: string) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return revokeApiToken({ client, path: { token_id: tokenId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listApiTokensQueryKey({ client }),
        ),
      })
    },
  })
}
