import type { APIRoute } from 'astro'

import { source } from '@/lib/source'

const origin = 'https://docs.oore.build'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export const prerender = true

export const GET: APIRoute = () => {
  const urls = source
    .getPages()
    .map((page) => (page.url === '/' ? `${origin}/` : `${origin}${page.url}`))
    .sort()
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
  ].join('')

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
