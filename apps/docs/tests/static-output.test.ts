import fs from 'node:fs'
import path from 'node:path'

import { create, load, search } from '@orama/orama'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { OPENAPI_CATEGORIES } from '../src/lib/openapi-categories'

const appDir = path.resolve(__dirname, '..')
const docsDir = path.join(appDir, 'content/docs')
const distDir = path.join(appDir, 'dist')
const publicDir = path.join(appDir, 'public')
const httpMethods = new Set([
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
])

type PublishedPage = {
  bodyText?: string
  route: string
  title: string
}

type GeneratedPage = PublishedPage & {
  description: string
  method: string
  operationId: string
  path: string
  tags: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function walk(directory: string): Array<string> {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}

function walkEntries(directory: string): Array<string> {
  return fs.readdirSync(directory).flatMap((entry) => {
    const file = path.join(directory, entry)
    return fs.lstatSync(file).isDirectory()
      ? [file, ...walkEntries(file)]
      : [file]
  })
}

function authoredPages(): Array<PublishedPage> {
  return walk(docsDir)
    .filter((file) => /\.(?:md|mdx)$/.test(file))
    .map((file) => {
      const source = fs.readFileSync(file, 'utf8')
      const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
      if (!match)
        throw new Error(`${path.relative(docsDir, file)} has no frontmatter`)

      const metadata = parse(match[1]) as unknown
      if (!isRecord(metadata) || typeof metadata.title !== 'string') {
        throw new Error(`${path.relative(docsDir, file)} has no title`)
      }

      const relative = path
        .relative(docsDir, file)
        .split(path.sep)
        .join('/')
        .replace(/\.(?:md|mdx)$/, '')
        .replace(/(^|\/)index$/, '')

      return {
        bodyText: source.slice(match[0].length),
        route: relative ? `/${relative}` : '/',
        title: metadata.title,
      }
    })
}

function generatedPages(): GeneratedPage[] {
  const spec = JSON.parse(
    fs.readFileSync(path.join(publicDir, 'openapi.json'), 'utf8'),
  ) as { paths?: unknown }
  if (!isRecord(spec.paths)) throw new Error('openapi.json has no paths')

  return Object.entries(spec.paths).flatMap(([route, pathItem]) => {
    if (!isRecord(pathItem)) return []

    return Object.entries(pathItem).flatMap(([method, operation]) => {
      if (!httpMethods.has(method) || !isRecord(operation)) return []
      if (typeof operation.operationId !== 'string') {
        throw new Error(
          `${method.toUpperCase()} ${route} has incomplete metadata`,
        )
      }

      return [
        {
          description:
            typeof operation.description === 'string' &&
            operation.description.trim()
              ? operation.description.trim()
              : typeof operation.summary === 'string' &&
                  operation.summary.trim()
                ? operation.summary.trim()
                : `${method.toUpperCase()} ${route}`,
          method: method.toUpperCase(),
          operationId: operation.operationId,
          path: route,
          route: `/openapi/operations/${operation.operationId}`,
          tags: Array.isArray(operation.tags)
            ? operation.tags.filter(
                (tag): tag is string => typeof tag === 'string',
              )
            : [],
          title:
            typeof operation.summary === 'string'
              ? operation.summary
              : operation.operationId,
        },
      ]
    })
  })
}

function generatedCategories(): Array<
  PublishedPage & { operations: ReturnType<typeof generatedPages> }
> {
  const operations = generatedPages()
  return OPENAPI_CATEGORIES.map((category) => ({
    operations: operations.filter((operation) =>
      category.tags.some((tag) => operation.tags.includes(tag)),
    ),
    route: `/reference/api/categories/${category.slug}`,
    title: category.title,
  }))
}

function publishedPages(): Array<GeneratedPage | PublishedPage> {
  return [...authoredPages(), ...generatedCategories(), ...generatedPages()]
}

function isGeneratedPage(
  page: GeneratedPage | PublishedPage,
): page is GeneratedPage {
  return 'operationId' in page
}

function htmlFileForRoute(route: string) {
  const relative = route.replace(/^\/|\/$/g, '')
  const candidates = relative
    ? [
        path.join(distDir, relative, 'index.html'),
        path.join(distDir, `${relative}.html`),
      ]
    : [path.join(distDir, 'index.html')]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

function htmlForRoute(route: string) {
  const file = htmlFileForRoute(route)
  if (!file) throw new Error(`No built HTML for ${route}`)
  return fs.readFileSync(file, 'utf8')
}

function articleHtmlForRoute(route: string) {
  const html = htmlForRoute(route)
  const article = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
  if (!article) throw new Error(`No rendered article for ${route}`)
  return article
}

function visibleArticleTextForRoute(route: string) {
  return articleHtmlForRoute(route)
    .replace(/<[^>]+>/g, '')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
}

function searchArtifact() {
  const candidates = [
    path.join(distDir, 'api/search'),
    path.join(distDir, 'api/search.json'),
    path.join(distDir, 'api/search/index.html'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function attributeValue(element: string, name: string) {
  return element.match(new RegExp(`\\b${name}=(["'])([\\s\\S]*?)\\1`, 'i'))?.[2]
}

function canonicalUrlsFromHtml(html: string) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((element) => attributeValue(element, 'rel') === 'canonical')
    .map((element) => attributeValue(element, 'href'))
    .filter((value): value is string => value !== undefined)
}

function decodeHtml(value: string | undefined) {
  return value
    ?.replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function metaContent(html: string, key: 'name' | 'property', value: string) {
  for (const element of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attributeValue(element, key) === value) {
      return attributeValue(element, 'content')
    }
  }
}

describe('static documentation artifact', () => {
  it('publishes every source-backed authored and generated route as raw HTML', () => {
    expect(fs.statSync(distDir).isDirectory()).toBe(true)

    for (const page of publishedPages()) {
      const text = visibleArticleTextForRoute(page.route)
      expect(text.toLocaleLowerCase(), page.route).toContain(
        page.title.toLocaleLowerCase(),
      )
      if (isGeneratedPage(page)) {
        expect(text, `${page.route} operationId`).toContain(page.operationId)
        expect(text, `${page.route} method`).toContain(page.method)
        expect(text, `${page.route} path`).toContain(page.path)
        expect(text, `${page.route} description`).toContain(
          page.description.replace(/\s+/g, ' '),
        )
      }
    }
  })

  it('partitions the complete built HTML inventory into pages and the 404', () => {
    const expected = [
      ...publishedPages().map((page) => {
        const file = htmlFileForRoute(page.route)
        if (!file) throw new Error(`No built HTML for ${page.route}`)
        return path.relative(distDir, file)
      }),
      '404.html',
    ].sort()
    const actual = walk(distDir)
      .filter((file) => file.endsWith('.html'))
      .map((file) => path.relative(distDir, file))
      .sort()

    expect(actual).toEqual(expected)
  })

  it('contains route-specific authored and OpenAPI content without JavaScript', () => {
    const authored = authoredPages().find(
      (page) => page.route === '/getting-started/install',
    )
    const generated = generatedPages().find(
      (page) => page.operationId === 'list_projects',
    )

    expect(authored).toBeDefined()
    expect(generated).toBeDefined()

    const authoredText = visibleArticleTextForRoute(authored!.route)
    expect(authoredText).toContain('Install on one Mac')
    expect(authoredText).not.toContain('Oore documentation')

    const generatedText = visibleArticleTextForRoute(generated!.route)
    expect(generatedText).toContain(generated!.title)
    expect(generatedText).toContain(generated!.method)
    expect(generatedText).toContain(generated!.path)
  })

  it('publishes tag-derived generated category pages', () => {
    for (const category of generatedCategories()) {
      const text = visibleArticleTextForRoute(category.route)
      expect(category.operations, category.route).not.toEqual([])
      for (const operation of category.operations) {
        expect(text, `${category.route} -> ${operation.operationId}`).toContain(
          operation.path,
        )
        expect(text, `${category.route} -> ${operation.operationId}`).toContain(
          operation.method,
        )
      }
    }
  })

  it('renders light and dark authored screenshot variants into raw HTML', () => {
    const html = htmlForRoute('/operations/release-channels')

    for (const image of ['demo-dashboard', 'demo-builds']) {
      expect(html).toContain(`src="/${image}.png"`)
      expect(html).toContain(`src="/${image}-dark.png"`)
    }
  })

  it('publishes real static service artifacts and regular deploy assets', () => {
    for (const artifact of [
      '404.html',
      '_headers',
      '_redirects',
      'robots.txt',
      'openapi.json',
    ]) {
      expect(fs.statSync(path.join(distDir, artifact)).isFile(), artifact).toBe(
        true,
      )
    }

    expect(fs.readFileSync(path.join(distDir, '_headers'), 'utf8')).toMatch(
      /\/api\/search\s+Content-Type: application\/json; charset=utf-8/,
    )

    expect(searchArtifact()).toBeDefined()
    expect(
      ['sitemap-index.xml', 'sitemap-0.xml', 'sitemap.xml'].some((file) =>
        fs.existsSync(path.join(distDir, file)),
      ),
    ).toBe(true)

    for (const asset of [
      'demo-builds-dark.png',
      'demo-builds.png',
      'demo-dashboard-dark.png',
      'demo-dashboard.png',
      'favicon.ico',
      'logo.svg',
      'logo192.png',
      'logo512.png',
      'og-image.png',
      'og-image.svg',
    ]) {
      const output = path.join(distDir, asset)
      expect(fs.lstatSync(output).isFile(), asset).toBe(true)
      expect(fs.lstatSync(output).isSymbolicLink(), asset).toBe(false)
    }

    for (const output of walkEntries(distDir)) {
      const entry = fs.lstatSync(output)
      expect(entry.isSymbolicLink(), path.relative(distDir, output)).toBe(false)
      expect(
        entry.isDirectory() || entry.isFile(),
        path.relative(distDir, output),
      ).toBe(true)
    }
  })

  it('exports authored and generated pages into the static search index', async () => {
    const artifact = searchArtifact()
    expect(artifact).toBeDefined()
    const index = fs.readFileSync(artifact!, 'utf8')

    for (const page of publishedPages()) {
      expect(index.includes(page.title), page.route).toBe(true)
    }

    const database = create({
      schema: { _: 'string' },
      language: 'english',
    })
    load(database, JSON.parse(index))
    for (const query of [
      {
        term: 'Install Oore CI',
        url: '/getting-started/install',
      },
      {
        term: 'Authentication',
        url: '/reference/api/categories/authentication',
      },
      {
        term: 'upload_local_artifact',
        url: '/openapi/operations/upload_local_artifact',
      },
      {
        term: 'PUT /v1/artifacts/local-upload/{token}',
        url: '/openapi/operations/upload_local_artifact',
      },
      {
        term: 'POST /v1/api-tokens',
        unique: true,
        url: '/openapi/operations/create_api_token',
      },
    ]) {
      const result = await search(database, {
        term: query.term,
        threshold: 0,
        limit: 20,
      })
      const pageIds = result.hits.map(
        (hit) => (hit.document as { page_id?: string }).page_id,
      )
      expect(pageIds, query.term).toContain(query.url)
      if (query.unique) {
        expect(new Set(pageIds), query.term).toEqual(new Set([query.url]))
      }
    }
  })

  it('publishes complete canonical and social metadata for every page', () => {
    for (const page of publishedPages()) {
      const html = htmlForRoute(page.route)
      const canonicals = canonicalUrlsFromHtml(html)
      const expectedCanonical =
        page.route === '/'
          ? 'https://docs.oore.build/'
          : `https://docs.oore.build${page.route}`
      const title = decodeHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1])
      const description = decodeHtml(metaContent(html, 'name', 'description'))

      expect(canonicals, page.route).toEqual([expectedCanonical])
      expect(title, `${page.route} title`).toBeTruthy()
      expect(description, `${page.route} description`).toBeTruthy()
      if (isGeneratedPage(page)) {
        expect(description, `${page.route} operation description`).toBe(
          page.description,
        )
      }
      expect(
        decodeHtml(metaContent(html, 'property', 'og:title')),
        page.route,
      ).toBe(title)
      expect(
        decodeHtml(metaContent(html, 'property', 'og:description')),
        page.route,
      ).toBe(description)
      expect(metaContent(html, 'property', 'og:url'), page.route).toBe(
        expectedCanonical,
      )
      expect(metaContent(html, 'property', 'og:image'), page.route).toBe(
        'https://docs.oore.build/og-image.png',
      )
      expect(metaContent(html, 'name', 'twitter:card'), page.route).toBe(
        'summary_large_image',
      )
      expect(
        decodeHtml(metaContent(html, 'name', 'twitter:title')),
        page.route,
      ).toBe(title)
      expect(
        decodeHtml(metaContent(html, 'name', 'twitter:description')),
        page.route,
      ).toBe(description)
      expect(metaContent(html, 'name', 'twitter:image'), page.route).toBe(
        'https://docs.oore.build/og-image.png',
      )
    }
  })

  it('keeps sitemap and robots aligned with the canonical page inventory', () => {
    const sitemap = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8')
    const actual = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    )
    const expected = publishedPages()
      .map((page) =>
        page.route === '/'
          ? 'https://docs.oore.build/'
          : `https://docs.oore.build${page.route}`,
      )
      .sort()

    expect(actual).toEqual(expected)
    expect(new Set(actual).size).toBe(actual.length)
    expect(
      actual.filter(
        (url) => url !== 'https://docs.oore.build/' && url.endsWith('/'),
      ),
    ).toEqual([])

    const robots = fs.readFileSync(path.join(distDir, 'robots.txt'), 'utf8')
    expect(robots).toContain('Sitemap: https://docs.oore.build/sitemap.xml')
  })

  it('publishes a dedicated not-found document instead of the home shell', () => {
    const notFound = fs.readFileSync(path.join(distDir, '404.html'), 'utf8')
    expect(notFound).toContain('Page not found')
    expect(notFound).not.toContain('Build, sign, and distribute Flutter apps')
    expect(notFound).toMatch(
      /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']noindex["'][^>]*>/i,
    )
    expect(notFound).not.toMatch(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)
  })
})
