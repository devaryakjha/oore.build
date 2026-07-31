import { ClientOnly, createFileRoute } from '@tanstack/react-router'

import { DocsRenderer, preloadPage } from '@/components/docs-renderer'
import { loadPage, pageHead } from '@/lib/page-loader'

export const Route = createFileRoute('/$')({
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/').filter(Boolean) ?? []
    return preloadPage(await loadPage({ data: slugs }))
  },
  head: ({ loaderData }) => pageHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()

  return (
    <ClientOnly fallback={<div className="min-h-screen bg-background" />}>
      <DocsRenderer data={data} />
    </ClientOnly>
  )
}
