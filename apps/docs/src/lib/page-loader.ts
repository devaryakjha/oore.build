import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

import { canonicalUrl } from '@/lib/shared'
import { source } from '@/lib/source'

export const loadPage = createServerFn({
  method: 'GET',
})
  .validator((slugs: string[]) => slugs)
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs)
    if (!page) throw notFound()

    const pageTree = await source.serializePageTree(source.getPageTree())
    const url = canonicalUrl(slugs)

    if (page.type === 'openapi') {
      return {
        type: 'openapi' as const,
        title: page.data.title,
        description: page.data.description,
        url,
        pageTree,
        props: page.data.getOpenAPIPageProps(),
      }
    }

    return {
      type: 'docs' as const,
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      url,
      pageTree,
    }
  })

export type LoadedPage = Awaited<ReturnType<typeof loadPage>>

export function pageHead(page?: LoadedPage) {
  if (!page) return {}

  const title =
    page.title === 'Oore CI documentation'
      ? 'Oore CI docs'
      : `${page.title} | Oore CI docs`

  return {
    meta: [
      { title },
      { name: 'description', content: page.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: page.description },
      { property: 'og:url', content: page.url },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: page.description },
    ],
    links: [{ rel: 'canonical', href: page.url }],
  }
}
