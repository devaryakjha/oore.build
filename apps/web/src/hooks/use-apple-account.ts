import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiContext } from '@/hooks/use-api-context'
import {
  getAppleAccount,
  getAppleAccountOperation,
  removeAppleAccount,
  selectAppleApp,
} from '@/lib/api'
import type { SelectAppleAppRequest } from '@/lib/types'

function accountKey(instanceId: string | undefined) {
  return [instanceId ?? '__none__', 'apple-account'] as const
}

export function useAppleAccount() {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: accountKey(instance?.id),
    queryFn: ({ signal }) => getAppleAccount(baseUrl!, token!, { signal }),
    enabled: !!baseUrl && !!token,
  })
}

export function useAppleAccountOperation(operationId: string | null) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'apple-account-operation',
      operationId,
    ],
    queryFn: ({ signal }) =>
      getAppleAccountOperation(baseUrl!, token!, operationId!, { signal }),
    enabled: !!baseUrl && !!token && !!operationId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'succeeded' || status === 'failed' ? false : 2_000
    },
  })
}

export function useSelectAppleApp() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: SelectAppleAppRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return selectAppleApp(baseUrl, token, data)
    },
    onSuccess: (account) => {
      queryClient.setQueryData(accountKey(instance?.id), account)
    },
  })
}

export function useRemoveAppleAccount() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: () => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return removeAppleAccount(baseUrl, token)
    },
    onSuccess: (account) => {
      queryClient.setQueryData(accountKey(instance?.id), account)
    },
  })
}

export function useRefreshAppleAccount() {
  const queryClient = useQueryClient()
  const { instance } = useApiContext()

  return () =>
    queryClient.invalidateQueries({ queryKey: accountKey(instance?.id) })
}
