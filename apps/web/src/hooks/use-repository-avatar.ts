import { useQuery } from '@tanstack/react-query'

import { repositoryAvatar } from '@/lib/api-client/generated/endpoints/integrations'
import { useApiContext } from '@/hooks/use-api-context'

export function useRepositoryAvatar(repositoryId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'repository-avatar', repositoryId],
    queryFn: ({ signal }) =>
      repositoryAvatar(repositoryId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token,
    staleTime: 60 * 60 * 1000,
  })
}
