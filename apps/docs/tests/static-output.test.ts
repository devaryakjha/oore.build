import fs from 'node:fs'
import path from 'node:path'

import { create, load, search } from '@orama/orama'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { createArtifactManifest } from '../scripts/artifact-manifest'
import {
  authoredNavigation,
  authoredCanonicals,
  clickableNavigationIndexes,
  contentRoute,
  editorialPages,
  openAPICategoryGroups,
  openAPINavigationGroups,
  readUrlContract,
  sourceTerminals,
} from '../scripts/public-contract'
import { OPENAPI_CATEGORIES } from '../src/lib/openapi-categories'

const appDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const docsDir = path.join(appDir, 'content/docs')
const distDir = path.join(appDir, 'dist')
const publicDir = path.join(appDir, 'public')
const treePath = path.join(repoDir, 'wayfinder/canonical-docs-tree.md')
const contract = readUrlContract(
  path.join(repoDir, 'wayfinder/public-docs-url-contract.md'),
)
const generatedMethodOrder = [
  'get',
  'post',
  'patch',
  'delete',
  'head',
  'put',
] as const

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

type NavigationNode = {
  children?: NavigationNode[]
  fallback?: NavigationNode
  name?: string
  type?: 'folder' | 'page' | 'root'
  url?: string
}

type NormalizedNavigationRecord = {
  label: string
  order: number
  parent: string
  type: 'folder' | 'page'
  url: string | null
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

      return {
        bodyText: source.slice(match[0].length),
        route: contentRoute(path.relative(docsDir, file)),
        title: metadata.title,
      }
    })
}

function generatedPages(): GeneratedPage[] {
  const spec = JSON.parse(
    fs.readFileSync(path.join(publicDir, 'openapi.json'), 'utf8'),
  ) as { paths?: unknown }
  if (!isRecord(spec.paths)) throw new Error('openapi.json has no paths')

  return Object.entries(spec.paths)
    .flatMap(([route, pathItem]) => {
      if (!isRecord(pathItem)) return []

      return generatedMethodOrder.flatMap((method) => {
        const operation = pathItem[method]
        if (!isRecord(operation)) return []
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
                : typeof pathItem.summary === 'string'
                  ? pathItem.summary
                  : `${operation.operationId[0]?.toUpperCase() ?? ''}${operation.operationId.slice(1)}`,
          },
        ]
      })
    })
    .map((page) => {
      if (page.tags.length !== 1) {
        throw new Error(
          `${page.method} ${page.path} must have exactly one navigation tag`,
        )
      }
      return page
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
    .replaceAll('&#39;', "'")
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
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function visibleNavigationLabel(value: string | undefined) {
  return decodeHtml(value)
    ?.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function metaContent(html: string, key: 'name' | 'property', value: string) {
  for (const element of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attributeValue(element, key) === value) {
      return attributeValue(element, 'content')
    }
  }
}

function htmlAttributeValues(html: string, tag: string, attribute: string) {
  const values: string[] = []
  const elementPattern = tag === '*' ? '<[a-z][^>]*>' : `<${tag}\\b[^>]*>`
  for (const element of html.match(new RegExp(elementPattern, 'gi')) ?? []) {
    const value = attributeValue(element, attribute)
    if (value) values.push(decodeHtml(value) ?? value)
  }
  return values
}

function fileForPublicPath(pathname: string) {
  return path.join(distDir, decodeURIComponent(pathname).replace(/^\//, ''))
}

function referencedAssetPaths() {
  const assets = new Set<string>()
  const add = (value: string, base: string) => {
    if (!value || value.startsWith('data:') || value.startsWith('#')) return
    const url = new URL(value, `https://docs.oore.build${base}`)
    if (url.origin === 'https://docs.oore.build') assets.add(url.pathname)
  }

  for (const page of [...publishedPages(), { route: '/404' }]) {
    const html =
      page.route === '/404'
        ? fs.readFileSync(path.join(distDir, '404.html'), 'utf8')
        : htmlForRoute(page.route)
    for (const src of [
      ...htmlAttributeValues(html, 'img', 'src'),
      ...htmlAttributeValues(html, 'script', 'src'),
    ]) {
      add(src, page.route)
    }
    for (const srcset of [
      ...htmlAttributeValues(html, 'img', 'srcset'),
      ...htmlAttributeValues(html, 'source', 'srcset'),
    ]) {
      for (const candidate of srcset.split(',')) {
        add(candidate.trim().split(/\s+/, 1)[0], page.route)
      }
    }
    for (const link of html.match(/<link\b[^>]*>/gi) ?? []) {
      const rel = attributeValue(link, 'rel') ?? ''
      const href = attributeValue(link, 'href')
      if (href && /\b(?:icon|modulepreload|preload|stylesheet)\b/.test(rel)) {
        add(decodeHtml(href) ?? href, page.route)
      }
    }
    for (const name of ['og:image', 'twitter:image'] as const) {
      const value =
        metaContent(html, 'property', name) ?? metaContent(html, 'name', name)
      if (value) add(value, page.route)
    }
  }

  const pending = [...assets]
  for (let index = 0; index < pending.length; index += 1) {
    const pathname = pending[index]
    if (!pathname.endsWith('.css')) continue
    const file = fileForPublicPath(pathname)
    if (!fs.existsSync(file)) continue
    const css = fs.readFileSync(file, 'utf8')
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      const before = assets.size
      add(match[2], pathname)
      if (assets.size > before) pending.push([...assets].at(-1)!)
    }
  }

  return [...assets].sort()
}

function expectValidAsset(pathname: string) {
  const file = fileForPublicPath(pathname)
  expect(fs.existsSync(file), pathname).toBe(true)
  expect(fs.lstatSync(file).isFile(), pathname).toBe(true)
  expect(fs.lstatSync(file).isSymbolicLink(), pathname).toBe(false)
  const contents = fs.readFileSync(file)
  expect(contents.byteLength, pathname).toBeGreaterThan(0)

  const extension = path.extname(file).toLowerCase()
  if (extension === '.png') {
    expect(contents.subarray(0, 8), pathname).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
    expect(contents.readUInt32BE(16), `${pathname} width`).toBeGreaterThan(0)
    expect(contents.readUInt32BE(20), `${pathname} height`).toBeGreaterThan(0)
  } else if (extension === '.ico') {
    expect(contents.subarray(0, 4), pathname).toEqual(Buffer.from([0, 0, 1, 0]))
    expect(contents.readUInt16LE(4), `${pathname} images`).toBeGreaterThan(0)
  } else if (extension === '.svg') {
    const svg = contents.toString()
    expect(svg, pathname).toMatch(/<svg\b/i)
    expect(svg, `${pathname} intrinsic size`).toMatch(
      /\bviewBox=["'][^"']+["']|\bwidth=["'][^"']+["'][\s\S]*\bheight=["'][^"']+["']/i,
    )
  } else if (extension === '.woff') {
    expect(contents.subarray(0, 4).toString('ascii'), pathname).toBe('wOFF')
  } else if (extension === '.woff2') {
    expect(contents.subarray(0, 4).toString('ascii'), pathname).toBe('wOF2')
  } else if (extension === '.otf') {
    expect(contents.subarray(0, 4).toString('ascii'), pathname).toBe('OTTO')
  } else if (extension === '.ttf') {
    expect(contents.readUInt32BE(0), pathname).toBe(0x0001_0000)
  }
}

function navigationTree() {
  const serialized = JSON.parse(
    fs.readFileSync(path.join(distDir, 'api/navigation.json'), 'utf8'),
  ) as { data?: NavigationNode }
  if (!serialized.data || serialized.data.type !== 'root') {
    throw new Error('Serialized navigation has no live root')
  }
  return serialized.data
}

function normalizedNavigation(
  node: NavigationNode,
  parent = 'root',
): NormalizedNavigationRecord[] {
  return (node.children ?? []).flatMap((child, order) => {
    if (child.type !== 'folder' && child.type !== 'page') {
      throw new Error(`Unexpected navigation node type: ${String(child.type)}`)
    }
    const label = visibleNavigationLabel(child.name)
    if (!label) throw new Error('Navigation node has no visible label')
    const record: NormalizedNavigationRecord = {
      label,
      order,
      parent,
      type: child.type,
      url: child.url ?? null,
    }
    return child.type === 'folder'
      ? [record, ...normalizedNavigation(child, `${parent}/${label}`)]
      : [record]
  })
}

function expectedNavigation(): NormalizedNavigationRecord[] {
  const tree = fs.readFileSync(treePath, 'utf8')
  const navigation = authoredNavigation(tree)
  const indexes = new Map(
    clickableNavigationIndexes(tree).map((index) => [index.path, index.label]),
  )
  const consumedIndexes = new Set<string>()
  const records: NormalizedNavigationRecord[] = []
  const page = (
    item: ReturnType<typeof editorialPages>[number] | PublishedPage,
    parent: string,
    order: number,
  ) => {
    const method =
      'method' in item && typeof item.method === 'string'
        ? item.method
        : undefined
    records.push({
      label: method ? `${item.title} ${method}` : item.title,
      order,
      parent,
      type: 'page',
      url: 'route' in item ? item.route : item.path,
    })
  }
  const folder = (label: string, parent: string, order: number) => {
    records.push({
      label,
      order,
      parent,
      type: 'folder',
      url: null,
    })
    return `${parent}/${label}`
  }

  if (indexes.get(navigation.root.path) !== 'page-tree root') {
    throw new Error('Canonical root page does not own the page-tree root')
  }
  consumedIndexes.add(navigation.root.path)
  page(navigation.root, 'root', 0)
  for (const [sectionIndex, section] of navigation.sections.entries()) {
    const sectionParent = folder(section.label, 'root', sectionIndex + 1)
    let sectionOrder = 0

    for (const item of section.items) {
      if (item.kind === 'page') {
        const indexLabel = indexes.get(item.page.path)
        if (indexLabel) {
          if (indexLabel !== section.label) {
            throw new Error(
              `Unexpected section index owner for ${item.page.path}: ${indexLabel}`,
            )
          }
          consumedIndexes.add(item.page.path)
        }
        page(item.page, sectionParent, sectionOrder)
        sectionOrder += 1
        continue
      }

      const itemParent = folder(item.label, sectionParent, sectionOrder)
      sectionOrder += 1
      let itemOrder = 0
      for (let index = 0; index < item.pages.length; index += 1) {
        const current = item.pages[index]
        const indexLabel = indexes.get(current.path)
        if (indexLabel && indexLabel !== item.label) {
          const nestedParent = folder(indexLabel, itemParent, itemOrder)
          consumedIndexes.add(current.path)
          itemOrder += 1
          let nestedEnd = index + 1
          while (item.pages[nestedEnd]?.path.startsWith(`${current.path}/`)) {
            nestedEnd += 1
          }
          const nestedPages = item.pages.slice(index, nestedEnd)
          if (
            item.pages
              .slice(nestedEnd)
              .some((candidate) =>
                candidate.path.startsWith(`${current.path}/`),
              )
          ) {
            throw new Error(
              `Nested index descendants are not contiguous: ${current.path}`,
            )
          }
          for (const [nestedOrder, nestedPage] of nestedPages.entries()) {
            page(nestedPage, nestedParent, nestedOrder)
          }
          index += nestedPages.length - 1
        } else {
          if (indexLabel) {
            consumedIndexes.add(current.path)
          }
          page(current, itemParent, itemOrder)
          itemOrder += 1
        }
      }
    }
  }

  if (
    consumedIndexes.size !== indexes.size ||
    [...indexes.keys()].some((index) => !consumedIndexes.has(index))
  ) {
    throw new Error('Canonical clickable index registry is not fully consumed')
  }

  const apiPage = records.find(
    (record) => record.type === 'page' && record.url === '/reference/api',
  )
  if (!apiPage) throw new Error('Canonical navigation has no API landing')
  const categoriesParent = folder('Categories', apiPage.parent, 1)
  const categoryRoutes = sourceTerminals(contract)
    .filter((row) => row.terminal?.startsWith('/reference/api/categories/'))
    .map((row) => row.terminal!)
  const acceptedCategories = openAPICategoryGroups(tree)
  if (
    categoryRoutes.length !== acceptedCategories.length ||
    acceptedCategories.length !== OPENAPI_CATEGORIES.length
  ) {
    throw new Error('Accepted OpenAPI category registries disagree')
  }
  for (const [order, category] of acceptedCategories.entries()) {
    const generated = OPENAPI_CATEGORIES[order]
    if (
      category.label !== generated.title ||
      category.tags.join('\0') !== generated.tags.join('\0') ||
      !categoryRoutes[order]?.endsWith(`/${generated.slug}`)
    ) {
      throw new Error(`OpenAPI category contract drift: ${category.label}`)
    }
    page(
      { route: categoryRoutes[order], title: category.label },
      categoriesParent,
      order,
    )
  }

  const operationsParent = folder('Operations', apiPage.parent, 2)
  const operations = generatedPages()
  for (const [groupOrder, group] of openAPINavigationGroups(tree).entries()) {
    const groupParent = folder(group.label, operationsParent, groupOrder)
    const groupPages = operations.filter((operation) =>
      operation.tags.includes(group.tag),
    )
    if (groupPages.length === 0) {
      throw new Error(`OpenAPI navigation group is empty: ${group.tag}`)
    }
    for (const [order, operation] of groupPages.entries()) {
      page(operation, groupParent, order)
    }
  }

  return records
}

describe('static documentation artifact', () => {
  it('produces the canonical complete-tree artifact manifest', () => {
    const manifest = createArtifactManifest(distDir)

    expect(manifest.schema).toBe('oore-docs-dist-v1')
    expect(manifest.entries).not.toEqual([])
    expect(manifest.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.entries.map((entry) => entry.path)).toEqual(
      [...manifest.entries]
        .sort((left, right) =>
          Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)),
        )
        .map((entry) => entry.path),
    )
  })

  it('matches the complete accepted canonical page set', () => {
    const expected = [
      ...authoredCanonicals(contract).map((row) => row.path),
      ...OPENAPI_CATEGORIES.map(
        (category) => `/reference/api/categories/${category.slug}`,
      ),
      ...generatedPages().map((page) => page.route),
    ].sort()
    const actual = publishedPages()
      .map((page) => page.route)
      .sort()

    expect(actual).toEqual(expected)
    expect(new Set(actual).size).toBe(actual.length)
  })

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

  it('renders every authored article as one distinct substantive document', () => {
    const substantive = new Map<string, string>()
    for (const page of authoredPages()) {
      const article = articleHtmlForRoute(page.route)
      const text = visibleArticleTextForRoute(page.route)
        .replace(page.title, '')
        .replace(/\s+/g, ' ')
        .trim()

      expect(article.match(/<h1\b/gi) ?? [], `${page.route} H1`).toHaveLength(1)
      expect(text.length, `${page.route} body`).toBeGreaterThan(120)
      expect(
        substantive.get(text),
        `${page.route} duplicate body`,
      ).toBeUndefined()
      substantive.set(text, page.route)
    }
    expect(substantive.size).toBe(authoredPages().length)
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
      (page) => page.route === '/start/install',
    )
    const generated = generatedPages().find(
      (page) => page.operationId === 'list_projects',
    )

    expect(authored).toBeDefined()
    expect(generated).toBeDefined()

    const authoredText = visibleArticleTextForRoute(authored!.route)
    expect(authoredText).toContain('Install Oore on one Mac')
    expect(authoredText).not.toContain('Oore documentation')

    const generatedText = visibleArticleTextForRoute(generated!.route)
    expect(generatedText).toContain(generated!.title)
    expect(generatedText).toContain(generated!.method)
    expect(generatedText).toContain(generated!.path)
  })

  it('renders authored fenced code through the Fumadocs CodeBlock and Shiki', () => {
    const pages = authoredPages().filter((page) =>
      /^```/m.test(page.bodyText ?? ''),
    )

    expect(pages).not.toEqual([])
    for (const page of pages) {
      const html = articleHtmlForRoute(page.route)
      expect(html, page.route).toMatch(/<figure\b[^>]*\bshiki\b/)
      expect(html, page.route).toMatch(/<button\b[^>]*aria-label="Copy Text"/)
      expect(html, page.route).toMatch(/<pre\b[^>]*class="[^"]*min-w-full/)
      expect(html, page.route).not.toMatch(/<pre class="shiki shiki-themes/)
    }

    expect(articleHtmlForRoute('/build/pipelines/oore-yaml')).toMatch(
      /<span\b[^>]*style="--shiki-light:[^;]+;--shiki-dark:[^"]+">version<\/span>/,
    )
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
    for (const [route, image] of [
      ['/', 'demo-dashboard'],
      ['/start/first-build', 'demo-builds'],
    ]) {
      const html = htmlForRoute(route)
      expect(html).toContain(`src="/${image}.png"`)
      expect(html).toContain(`src="/${image}-dark.png"`)
    }
  })

  it('publishes real static service artifacts and regular deploy assets', () => {
    for (const artifact of [
      '404.html',
      '_headers',
      '_redirects',
      'api/navigation.json',
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

  it('resolves all built links, fragments, and transitive asset references', () => {
    const canonicals = new Set(publishedPages().map((page) => page.route))
    const broken: string[] = []

    for (const page of publishedPages()) {
      const html = htmlForRoute(page.route)
      for (const href of htmlAttributeValues(html, 'a', 'href')) {
        if (
          /^(?:mailto:|tel:|javascript:)/i.test(href) ||
          href.startsWith('//')
        ) {
          continue
        }
        const url = new URL(
          href,
          page.route === '/'
            ? 'https://docs.oore.build/'
            : `https://docs.oore.build${page.route}`,
        )
        if (url.origin !== 'https://docs.oore.build') continue

        const route =
          url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '')
        if (!canonicals.has(route)) {
          const staticFile = fileForPublicPath(url.pathname)
          if (!fs.existsSync(staticFile) || !fs.statSync(staticFile).isFile()) {
            broken.push(`${page.route} -> ${href}`)
          }
          continue
        }

        if (url.hash) {
          const ids = new Set(
            htmlAttributeValues(htmlForRoute(route), '*', 'id').map((id) =>
              decodeURIComponent(id),
            ),
          )
          const fragment = decodeURIComponent(url.hash.slice(1))
          if (!ids.has(fragment)) broken.push(`${page.route} -> ${href}`)
        }
      }
    }
    expect(broken.sort()).toEqual([])

    const assets = referencedAssetPaths()
    expect(assets).not.toEqual([])
    for (const asset of assets) expectValidAsset(asset)
  }, 15_000)

  it('keeps forbidden internal payloads out of the complete artifact', () => {
    const forbidden = [
      'mac-studio-netbird-warpgate',
      'release-automation-mac-mini',
      '/Users/',
      'file://',
      '.codex/',
      '.agents/',
    ]
    const findings: string[] = []
    for (const file of walk(distDir)) {
      const contents = fs.readFileSync(file)
      if (contents.includes(0)) continue
      const text = contents.toString('utf8')
      for (const value of forbidden) {
        if (text.includes(value)) {
          findings.push(`${path.relative(distDir, file)} -> ${value}`)
        }
      }
    }
    expect(findings).toEqual([])
  })

  it('serializes the complete accepted hierarchy from the live loader tree', () => {
    const root = navigationTree()
    expect(root.fallback).toBeUndefined()
    const actual = normalizedNavigation(root)
    const expected = expectedNavigation()
    expect(actual).toEqual(expected)

    const pages = actual.filter((record) => record.type === 'page')
    expect(
      pages
        .map((page) => page.url)
        .sort((left, right) => (left ?? '').localeCompare(right ?? '')),
    ).toEqual(
      publishedPages()
        .map((page) => page.route)
        .sort((left, right) => left.localeCompare(right)),
    )
    expect(new Set(pages.map((page) => page.url)).size).toBe(pages.length)

    const operations = expected.find(
      (record) =>
        record.type === 'folder' &&
        record.label === 'Operations' &&
        record.parent.endsWith('/API'),
    )
    expect(operations).toBeDefined()
    const groups = openAPINavigationGroups(
      fs.readFileSync(treePath, 'utf8'),
    ).map((group) => group.label)
    const actualGroups = actual.filter(
      (record) =>
        record.type === 'folder' &&
        record.parent === `${operations!.parent}/Operations`,
    )
    expect(actualGroups.map((group) => group.label)).toEqual(groups)
    expect(actualGroups.every((group) => group.url === null)).toBe(true)
  })

  it('exports authored and generated pages into the static search index', async () => {
    const artifact = searchArtifact()
    expect(artifact).toBeDefined()
    const index = fs.readFileSync(artifact!, 'utf8')

    const serialized = JSON.parse(index) as {
      docs?: { docs?: Record<string, { page_id?: string }> }
    }
    const indexedDocuments = Object.values(serialized.docs?.docs ?? {})
      .map((document) => document.page_id)
      .filter((route): route is string => typeof route === 'string')
    const indexedRoutes = [...new Set(indexedDocuments)].sort()
    const expectedRoutes = publishedPages()
      .map((page) => page.route)
      .sort()

    expect(indexedRoutes).toEqual(expectedRoutes)
    expect(indexedDocuments).not.toEqual([])
    expect(
      indexedDocuments.every((route) => indexedRoutes.includes(route)),
    ).toBe(true)

    const database = create({
      schema: { _: 'string' },
      language: 'english',
    })
    load(database, JSON.parse(index))
    for (const query of [
      {
        term: 'Install Oore on one Mac',
        url: '/start/install',
      },
      {
        term: 'consistent SQLite snapshot',
        unique: true,
        url: '/operate/maintain/backups/create',
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

  it('keeps removed internal and unknown pages outside every static surface', () => {
    const removed = sourceTerminals(contract).filter(
      (row) => row.response === 404,
    )
    const sitemap = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8')
    const searchIndex = fs.readFileSync(searchArtifact()!, 'utf8')
    const redirects = fs.readFileSync(path.join(distDir, '_redirects'), 'utf8')

    for (const row of removed) {
      expect(htmlFileForRoute(row.source), row.source).toBeUndefined()
      expect(sitemap, row.source).not.toContain(row.source)
      expect(searchIndex, row.source).not.toContain(row.source)
      expect(redirects, row.source).not.toContain(row.source)
    }
  })
})
