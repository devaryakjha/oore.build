import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'
import type { Root } from 'fumadocs-core/page-tree'
import { structure } from 'fumadocs-core/mdx-plugins'
import type { StaticSource } from 'fumadocs-core/source'
import { loader } from 'fumadocs-core/source'
import path from 'node:path'

import { openAPICategoryPages } from '@/lib/openapi-categories'
import { openapi } from '@/lib/openapi'

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

function nestOpenAPIUnderReference(tree: Root) {
  const reference = tree.children.find(
    (node) => node.type === 'folder' && node.$ref?.folder === 'reference',
  )
  const openapi = tree.children.find(
    (node) => node.type === 'folder' && node.$ref?.folder === 'openapi',
  )

  if (reference?.type !== 'folder' || openapi?.type !== 'folder') return tree

  const api = reference.children.find(
    (node) => node.type === 'folder' && node.$ref?.folder === 'reference/api',
  )
  if (api?.type === 'folder') {
    if (openapi.index) api.children.push(openapi.index)
    api.children.push(...openapi.children)
  } else {
    reference.children.push(openapi)
  }

  tree.children = tree.children.filter((node) => node !== openapi)
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
