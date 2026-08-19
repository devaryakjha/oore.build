import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createApiToken, listApiTokens, revokeApiToken } from '@/api/api-tokens'
import type { CreateApiTokenRequest, ListApiTokensParams } from '@/api/types'
import { useApiContext } from '@/hooks/use-api-context'

export function useApiTokens(params?: ListApiTokensParams) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'api-tokens', params ?? {}],
    queryFn: ({ signal }) =>
      listApiTokens(params, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
  })
}

export function useCreateApiToken() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: CreateApiTokenRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return createApiToken(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'api-tokens'],
      })
    },
  })
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (tokenId: string) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return revokeApiToken(tokenId, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'api-tokens'],
      })
    },
  })
}
