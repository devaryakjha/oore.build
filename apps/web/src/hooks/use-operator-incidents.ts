import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiContext } from '@/hooks/use-api-context'
import { listOperatorIncidents, markOperatorIncidentRead } from '@/lib/api'

export function useOperatorIncidents(options?: {
  enabled?: boolean
  resourceId?: string
}) {
  const { baseUrl, instance, token } = useApiContext()
  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'operator-incidents',
      options?.resourceId ?? 'all',
    ],
    queryFn: ({ signal }) =>
      listOperatorIncidents(
        baseUrl!,
        token!,
        { status: 'open', resource_id: options?.resourceId },
        { signal },
      ),
    enabled: options?.enabled !== false && !!baseUrl && !!token,
    refetchInterval: 60_000,
  })
}

export function useMarkOperatorIncidentRead() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()
  return useMutation({
    mutationFn: (incidentId: string) =>
      markOperatorIncidentRead(baseUrl!, token!, incidentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'operator-incidents'],
      }),
  })
}
