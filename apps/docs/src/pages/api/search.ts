import type { APIRoute } from 'astro'
import { createFromSource } from 'fumadocs-core/search/server'

import { source, structuredDataForPage } from '@/lib/source'

const server = createFromSource(source, {
  language: 'english',
  buildIndex(page) {
    return {
      id: page.url,
      title: page.data.title ?? page.url,
      description: page.data.description,
      structuredData: structuredDataForPage(page),
      url: page.url,
    }
  },
})

export const prerender = true

export const GET: APIRoute = () => server.staticGET()
