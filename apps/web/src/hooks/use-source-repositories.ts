import { useInfiniteQuery } from '@tanstack/react-query'

import { listSourceRepositories } from '@/lib/api-client/generated/endpoints/integrations'
import { useApiContext } from '@/hooks/use-api-context'

const PAGE_SIZE = 100

export function useSourceRepositories(enabled: boolean) {
  const { baseUrl, instance, token } = useApiContext()

  return useInfiniteQuery({
    queryKey: [instance?.id ?? '__none__', 'source-repositories'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listSourceRepositories(
        { limit: PAGE_SIZE, offset: pageParam },
        { baseUrl: baseUrl!, token: token!, signal },
      ),
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
