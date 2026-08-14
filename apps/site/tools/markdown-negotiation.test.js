import { describe, expect, test } from 'bun:test'

import worker, { acceptsMarkdown } from '../public/_worker.js'

const env = {
  ASSETS: {
    fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/index.md') return new Response('# Oore CI\n')
      return new Response('<h1>Oore CI</h1>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    },
  },
}

describe('Markdown content negotiation', () => {
  test('returns Markdown for an accepted Markdown representation', async () => {
    const response = await worker.fetch(
      new Request('https://oore.build/', {
        headers: { accept: 'text/markdown' },
      }),
      env,
    )
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    )
    expect(response.headers.get('vary')).toContain('Accept')
    expect(response.headers.get('x-markdown-tokens')).toBeTruthy()
    expect(await response.text()).toBe('# Oore CI\n')
  })

  test('keeps HTML as the browser default', async () => {
    const response = await worker.fetch(
      new Request('https://oore.build/', {
        headers: { accept: 'text/html' },
      }),
      env,
    )
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('vary')).toContain('Accept')
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, must-revalidate',
    )
    expect(response.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    )
    expect(response.headers.get('content-security-policy')).toBe(
      "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
    )
  })

  test('rejects a zero-quality Markdown representation', () => {
    expect(acceptsMarkdown('text/html, text/markdown;q=0')).toBe(false)
  })

  test('applies script cache policy through the advanced mode worker', async () => {
    const response = await worker.fetch(
      new Request('https://oore.build/install'),
      env,
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    )
    expect(await response.text()).toContain('Oore CI')
  })

  test('keeps Markdown HEAD responses empty', async () => {
    const response = await worker.fetch(
      new Request('https://oore.build/', {
        method: 'HEAD',
        headers: { accept: 'text/markdown' },
      }),
      env,
    )
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    )
    expect(await response.text()).toBe('')
  })
})
