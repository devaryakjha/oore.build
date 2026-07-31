import { Suspense, type ReactNode } from 'react'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import browserCollections from 'collections/browser'

import { OpenAPIPage } from '@/components/api-page'
import { useMDXComponents } from '@/components/mdx'
import { baseOptions } from '@/lib/layout.shared'
import type { LoadedPage } from '@/lib/page-loader'

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={useMDXComponents()} />
        </DocsBody>
      </DocsPage>
    )
  },
})

export async function preloadPage(page: LoadedPage) {
  if (page.type === 'docs') {
    await clientLoader.preload(page.path)
  }

  return page
}

export function DocsRenderer({ data }: { data: LoadedPage }) {
  const page = useFumadocsLoader(data)
  let content: ReactNode

  if (page.type === 'openapi') {
    content = (
      <DocsPage full>
        <DocsTitle>{page.title}</DocsTitle>
        <DocsDescription>{page.description}</DocsDescription>
        <DocsBody>
          <OpenAPIPage {...page.props} />
        </DocsBody>
      </DocsPage>
    )
  } else {
    content = clientLoader.useContent(page.path)
  }

  return (
    <DocsLayout {...baseOptions()} tree={page.pageTree}>
      <Suspense>{content}</Suspense>
    </DocsLayout>
  )
}
