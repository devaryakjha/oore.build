import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiContext } from '@/hooks/use-api-context'
import { markOperatorIncidentRead } from '@oore/client/operations'
import {
  listOperatorIncidentsOptions,
  listOperatorIncidentsQueryKey,
} from '@oore/client/react-query'
import {
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

export function useOperatorIncidents(options?: {
  enabled?: boolean
  resourceId?: string
}) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    listOperatorIncidentsOptions({
      client,
      query: { status: 'open', resource_id: options?.resourceId },
    }),
  )
  return useQuery({
    ...query,
    enabled: options?.enabled !== false && !!baseUrl && !!token,
    refetchInterval: 60_000,
  })
}

export function useMarkOperatorIncidentRead() {
  const queryClient = useQueryClient()
  const { client, instanceId } = useApiContext()
  return useMutation({
    mutationFn: (incidentId: string) =>
      markOperatorIncidentRead({ client, path: { id: incidentId } }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listOperatorIncidentsQueryKey({ client }),
        ),
      }),
  })
}
