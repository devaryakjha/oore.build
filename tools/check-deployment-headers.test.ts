import { describe, expect, test } from 'bun:test'

import {
  resolveHeaderSmokeHosts,
  runDeploymentHeaderSmoke,
} from './check-deployment-headers'

const security = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy':
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
}

function successfulFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString())
  if (url.pathname === '/') {
    const asset = url.hostname.startsWith('docs.')
      ? '/_astro/app.hash.js'
      : '/assets/app.hash.js'
    return Promise.resolve(
      new Response(`<script src="${asset}"></script>`, {
        headers: {
          ...security,
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      }),
    )
  }
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/_astro/')
  ) {
    return Promise.resolve(
      new Response('asset', {
        headers: {
          'cache-control': 'public, max-age=31536000, immutable',
        },
      }),
    )
  }
  if (url.pathname === '/install' || url.pathname === '/uninstall') {
    return Promise.resolve(
      new Response('script', { headers: { 'cache-control': 'no-store' } }),
    )
  }
  return Promise.resolve(
    Response.json(
      {},
      {
        headers: { 'cache-control': 'public, max-age=60, s-maxage=300' },
      },
    ),
  )
}

describe('deployment header smoke checker', () => {
  test('accepts the required observable deployment contract', async () => {
    const failures = await runDeploymentHeaderSmoke(
      resolveHeaderSmokeHosts({
        OORE_HEADER_SMOKE_BASE_DOMAIN: 'example.test',
      }),
      successfulFetch,
    )
    expect(failures).toEqual([])
  })

  test('reports the host, path, expected value, and actual value', async () => {
    const failures = await runDeploymentHeaderSmoke(
      resolveHeaderSmokeHosts({
        OORE_HEADER_SMOKE_BASE_DOMAIN: 'example.test',
      }),
      async (input) => {
        const response = await successfulFetch(input)
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        )
        if (
          url.hostname === 'docs.example.test' &&
          url.pathname.startsWith('/_astro/')
        ) {
          return new Response(response.body, {
            headers: { 'cache-control': 'public, max-age=14400' },
          })
        }
        return response
      },
    )
    expect(failures).toContainEqual({
      hostname: 'docs.example.test',
      path: '/_astro/app.hash.js',
      expected: 'cache-control: public, max-age=31536000, immutable',
      actual: 'cache-control: public, max-age=14400',
    })
  })
})
