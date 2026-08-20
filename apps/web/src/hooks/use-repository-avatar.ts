import { useQuery } from '@tanstack/react-query'

import { repositoryAvatarOptions } from '@oore/client/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import { scopeOoreQueryOptions } from '@/lib/api-client/client'

export function useRepositoryAvatar(repositoryId: string) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    repositoryAvatarOptions({ client, path: { id: repositoryId } }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
    staleTime: 60 * 60 * 1000,
  })
}
