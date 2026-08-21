import { useInfiniteQuery } from '@tanstack/react-query'

import { listSourceRepositoriesInfiniteOptions } from '@oore/client/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import { scopeOoreInfiniteQueryOptions } from '@/lib/api-client/client'

const PAGE_SIZE = 100

export function useSourceRepositories(enabled: boolean) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreInfiniteQueryOptions(
    instanceId,
    listSourceRepositoriesInfiniteOptions({
      client,
      query: { limit: PAGE_SIZE },
    }),
  )

  return useInfiniteQuery({
    ...query,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce(
        (count, page) => count + page.repositories.length,
        0,
      )
      return loaded < lastPage.total ? loaded : undefined
    },
    enabled: enabled && !!baseUrl && !!token,
  })
}
