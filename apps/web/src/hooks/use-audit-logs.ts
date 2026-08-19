import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listAuditLogs } from '@/api/audit-logs'
import { useApiContext } from '@/hooks/use-api-context'

export function useAuditLogs(params?: {
  limit?: number
  offset?: number
  actor_id?: string
  action?: string
  resource_type?: string
  from_ts?: number
  to_ts?: number
  sort?: 'created_at' | 'actor_email' | 'action' | 'resource_type'
  direction?: 'asc' | 'desc'
}) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'audit-logs', params ?? {}],
    queryFn: ({ signal }) =>
      listAuditLogs(params, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
    placeholderData: keepPreviousData,
  })
}
