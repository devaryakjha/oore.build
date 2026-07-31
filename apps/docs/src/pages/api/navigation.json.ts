import type { APIRoute } from 'astro'

import { source } from '@/lib/source'

export const prerender = true

export const GET: APIRoute = async () =>
  new Response(
    JSON.stringify(await source.serializePageTree(source.getPageTree())),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )
