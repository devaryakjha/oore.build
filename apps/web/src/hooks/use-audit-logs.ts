import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listAuditLogsOptions } from '@oore/client/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import { scopeOoreQueryOptions } from '@/lib/api-client/client'

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
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    listAuditLogsOptions({ client, query: params }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
    placeholderData: keepPreviousData,
  })
}
