import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  listRunners,
  updateRunner,
} from '@/lib/api-client/generated/endpoints/runners'
import type {
  ListRunnersParams,
  ListRunnersResponse,
  UpdateRunnerRequest,
} from '@/lib/api-client/generated/models'
import { useApiContext } from '@/hooks/use-api-context'

export function useRunners<TData = ListRunnersResponse>(
  params?: ListRunnersParams,
  options?: { select?: (data: ListRunnersResponse) => TData },
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery<ListRunnersResponse, Error, TData>({
    queryKey: [instance?.id ?? '__none__', 'runners', params ?? {}],
    queryFn: ({ signal }) =>
      listRunners(params, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
    refetchInterval: 15_000,
    select: options?.select,
  })
}

export function useUpdateRunner() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      runnerId,
      data,
    }: {
      runnerId: string
      data: UpdateRunnerRequest
    }) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return updateRunner(runnerId, data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'runners'],
      })
    },
  })
}
