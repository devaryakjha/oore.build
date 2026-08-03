import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'
import type { Folder, Item, Root } from 'fumadocs-core/page-tree'
import { structure } from 'fumadocs-core/mdx-plugins'
import type {
  ContentStorage,
  PageTreeBuilderContext,
  StaticSource,
} from 'fumadocs-core/source'
import { loader } from 'fumadocs-core/source'
import fs from 'node:fs'
import path from 'node:path'

import { openAPINavigationGroups } from '../../scripts/public-contract'
import { openAPICategoryPages } from '@/lib/openapi-categories'
import { openapi } from '@/lib/openapi'

const canonicalTree = fs.readFileSync(
  path.resolve(process.cwd(), '../../wayfinder/canonical-docs-tree.md'),
  'utf8',
)
const operationNavigationGroups = openAPINavigationGroups(canonicalTree)

type AuthoredPageData = CollectionEntry<'docs'>['data'] & {
  _raw: CollectionEntry<'docs'>
}

type AuthoredMetaData = CollectionEntry<'meta'>['data']

async function createAuthoredSource(): Promise<
  StaticSource<{
    metaData: AuthoredMetaData
    pageData: AuthoredPageData
  }>
> {
  const files: StaticSource<{
    metaData: AuthoredMetaData
    pageData: AuthoredPageData
  }>['files'] = []

  for (const page of await getCollection('docs')) {
    files.push({
      type: 'page',
      path: path.relative('content/docs', page.filePath!),
      data: {
        ...page.data,
        _raw: page,
      },
    })
  }

  for (const meta of await getCollection('meta')) {
    files.push({
      type: 'meta',
      path: path.relative('content/docs', meta.filePath!),
      data: meta.data,
    })
  }

  return { files }
}

function generatedFolder(root: Root, folder: string): Folder {
  return {
    $id: root.$id,
    $ref: root.$ref ?? { folder },
    children: root.children,
    description: root.description,
    name: root.name,
    type: 'folder',
  }
}

function operationNavigation(page: Item, storage: ContentStorage) {
  if (!page.$ref) {
    throw new Error(`Generated operation navigation has no source: ${page.url}`)
  }
  const file = storage.read(page.$ref)
  if (!file || file.format !== 'page') {
    throw new Error(`Generated operation source is missing: ${page.url}`)
  }

  const data = file.data as Record<string, unknown>
  const getProps = data.getOpenAPIPageProps
  if (typeof getProps !== 'function') {
    throw new Error(`Generated operation data is incomplete: ${page.url}`)
  }
  const props = getProps() as {
    operations?: Array<{ method: string; path: string }>
    payload?: { bundled?: unknown }
  }
  const operationItem = props.operations?.[0]
  const document = props.payload?.bundled
  if (
    props.operations?.length !== 1 ||
    !operationItem ||
    !isRecord(document) ||
    !isRecord(document.paths)
  ) {
    throw new Error(`Generated operation data is incomplete: ${page.url}`)
  }

  const pathItem = document.paths[operationItem.path]
  if (!isRecord(pathItem)) {
    throw new Error(`Generated operation path is incomplete: ${page.url}`)
  }
  const operation = pathItem[operationItem.method]
  if (
    !isRecord(operation) ||
    !Array.isArray(operation.tags) ||
    operation.tags.length !== 1 ||
    typeof operation.tags[0] !== 'string'
  ) {
    throw new Error(
      `Generated operation must have exactly one navigation tag: ${page.url}`,
    )
  }

  const tagOrder = Array.isArray(document.tags)
    ? document.tags.flatMap((tag) =>
        isRecord(tag) && typeof tag.name === 'string' ? [tag.name] : [],
      )
    : []
  return { tag: operation.tags[0], tagOrder }
}

function groupedOperationFolder(root: Root, storage: ContentStorage): Folder {
  const pages = root.children.filter((node): node is Item => {
    if (node.type !== 'page') {
      throw new Error('Generated operation source must contain only pages')
    }
    return true
  })
  const groups = new Map<string, Item[]>()
  let tagOrder: string[] | undefined

  for (const page of pages) {
    const navigation = operationNavigation(page, storage)
    tagOrder ??= navigation.tagOrder
    if (
      navigation.tagOrder.length === 0 ||
      navigation.tagOrder.join('\0') !== tagOrder.join('\0')
    ) {
      throw new Error('Generated operation tag declarations are inconsistent')
    }
    const group = groups.get(navigation.tag) ?? []
    group.push(page)
    groups.set(navigation.tag, group)
  }

  if (
    pages.length === 0 ||
    !tagOrder ||
    tagOrder.join('\0') !==
      operationNavigationGroups.map((group) => group.tag).join('\0') ||
    tagOrder.length !== groups.size ||
    tagOrder.some((tag) => !groups.has(tag))
  ) {
    throw new Error(
      `Generated operation navigation does not cover every tag: ${JSON.stringify(
        {
          declared: tagOrder,
          pages: pages.length,
          used: [...groups],
        },
      )}`,
    )
  }

  return {
    $id: root.$id,
    $ref: root.$ref ?? { folder: 'openapi/operations' },
    children: operationNavigationGroups.map((group) => ({
      $id: `openapi-tag:${group.tag}`,
      children: groups.get(group.tag)!,
      name: group.label,
      type: 'folder',
    })),
    description: root.description,
    name: 'Operations',
    type: 'folder',
  }
}

function nestOpenAPIUnderReference<S extends ContentStorage>(
  this: PageTreeBuilderContext<S>,
  tree: Root,
) {
  if (this.custom?._fallback === true) return tree

  const reference = tree.children.find(
    (node) => node.type === 'folder' && node.$ref?.folder === 'reference',
  )

  if (reference?.type !== 'folder') return tree

  const api = reference.children.find(
    (node) => node.type === 'folder' && node.$ref?.folder === 'reference/api',
  )
  if (api?.type === 'folder') {
    api.children.push(
      generatedFolder(
        this.builder.root(
          'generated-openapi-categories',
          'reference/api/categories',
        ),
        'reference/api/categories',
      ),
      groupedOperationFolder(
        this.builder.root('generated-openapi-operations', 'openapi/operations'),
        this.storage,
      ),
    )
  }

  return tree
}

export const source = loader(
  {
    docs: await createAuthoredSource(),
    openapiCategories: await openapi.staticSource({
      ...openAPICategoryPages,
      baseDir: 'reference/api/categories',
      meta: true,
    }),
    openapiOperations: await openapi.staticSource({
      baseDir: 'openapi/operations',
      meta: true,
    }),
  },
  {
    baseUrl: '/',
    pageTree: {
      generateFallback: false,
      transformers: [
        {
          root: nestOpenAPIUnderReference,
        },
      ],
    },
    plugins: [openapi.loaderPlugin()],
  },
)

export type DocsPage = (typeof source)['$inferPage']

export function isAuthoredPage(
  page: DocsPage,
): page is Extract<DocsPage, { type: 'docs' }> {
  return page.type === 'docs'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function openAPIOperationDetails(page: DocsPage) {
  if (page.type !== 'openapiOperations') return

  const props = page.data.getOpenAPIPageProps()
  const item = props.operations?.[0]
  const paths = (
    props.payload.bundled as {
      paths?: Record<string, unknown>
    }
  ).paths
  const pathItem = item ? paths?.[item.path] : undefined
  const operation =
    item && isRecord(pathItem) ? pathItem[item.method] : undefined

  if (
    !item ||
    props.operations?.length !== 1 ||
    !isRecord(operation) ||
    typeof operation.operationId !== 'string' ||
    operation.operationId.trim() === ''
  ) {
    throw new Error(`Generated operation page is incomplete: ${page.url}`)
  }

  const method = item.method.toUpperCase()
  const operationId = operation.operationId
  const summary =
    typeof operation.summary === 'string' && operation.summary.trim()
      ? operation.summary.trim()
      : undefined
  const operationDescription =
    typeof operation.description === 'string' && operation.description.trim()
      ? operation.description.trim()
      : undefined
  const title = summary ?? page.data.title?.trim() ?? operationId

  return {
    description: operationDescription ?? summary ?? `${method} ${item.path}`,
    method,
    operationId,
    path: item.path,
    title,
  }
}

export function structuredDataForPage(page: DocsPage) {
  if (isAuthoredPage(page)) return structure(page.data._raw.body ?? '')
  const operation = openAPIOperationDetails(page)
  if (operation) {
    return {
      headings: page.data.structuredData.headings,
      contents: [
        {
          heading: 'HTTP operation',
          content: `${operation.operationId}\n${operation.method} ${operation.path}`,
        },
        ...page.data.structuredData.contents,
      ],
    }
  }
  if (page.type !== 'openapiCategories') return page.data.structuredData

  return {
    headings: [],
    contents: page.data.description
      ? [{ heading: undefined, content: page.data.description }]
      : [],
  }
}
