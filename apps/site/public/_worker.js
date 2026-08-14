function acceptsMarkdown(header) {
  if (!header) return false
  return header.split(',').some((entry) => {
    const [mediaType, ...parameters] = entry.split(';')
    if (mediaType.trim().toLowerCase() !== 'text/markdown') return false
    const quality = parameters
      .map((parameter) => parameter.trim().toLowerCase())
      .find((parameter) => parameter.startsWith('q='))
    return quality ? Number(quality.slice(2)) > 0 : true
  })
}

function appendVary(headers, value) {
  const values = new Set(
    (headers.get('vary') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  values.add(value)
  headers.set('vary', [...values].join(', '))
}

const SECURITY_HEADERS = {
  'content-security-policy':
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
}

function withSiteHeaders(response, url) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value)
  }
  if (url.pathname === '/install' || url.pathname === '/uninstall') {
    headers.set('cache-control', 'no-store')
    headers.set('content-type', 'text/plain; charset=utf-8')
  } else if (url.pathname === '/' || url.pathname === '/index.html') {
    headers.set('cache-control', 'public, max-age=0, must-revalidate')
    headers.set('link', '<https://docs.oore.build/>; rel="service-doc"')
  } else if (
    url.pathname === '/logo.svg' ||
    url.pathname.startsWith('/product/') ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/sitemap.xml'
  ) {
    headers.set('cache-control', 'public, max-age=3600, must-revalidate')
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export { acceptsMarkdown }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const negotiablePath =
      url.pathname === '/' || url.pathname === '/index.html'
    const markdownRequested =
      negotiablePath && acceptsMarkdown(request.headers.get('accept'))

    if (markdownRequested) {
      const markdownUrl = new URL('/index.md', url)
      const asset = await env.ASSETS.fetch(new Request(markdownUrl, request))
      const markdown = request.method === 'HEAD' ? '' : await asset.text()
      const headers = new Headers(asset.headers)
      headers.set('content-type', 'text/markdown; charset=utf-8')
      headers.set('x-markdown-tokens', String(Math.ceil(markdown.length / 4)))
      appendVary(headers, 'Accept')
      return withSiteHeaders(
        new Response(markdown, { status: asset.status, headers }),
        url,
      )
    }

    const response = await env.ASSETS.fetch(request)
    if (!negotiablePath) return withSiteHeaders(response, url)
    const headers = new Headers(response.headers)
    appendVary(headers, 'Accept')
    return withSiteHeaders(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
      url,
    )
  },
}
