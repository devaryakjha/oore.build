import fs from 'node:fs'
import path from 'node:path'

import { OPENAPI_CATEGORIES } from '../src/lib/openapi-categories'
import {
  authoredCanonicals,
  buildRedirectRules,
  readUrlContract,
  sourceTerminals,
  type RedirectRule,
} from './public-contract'

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

export const browserInteractionCases = [
  'interaction:desktop-navigation',
  'interaction:mobile-navigation',
  'interaction:static-search-authored',
  'interaction:static-search-operation',
  'interaction:theme-light-dark-system',
  'interaction:openapi-copy-tabs',
  'interaction:back-forward-reload',
  'interaction:not-found-document',
  'interaction:reduced-motion',
  'interaction:metadata-navigation',
  'interaction:responsive-accessibility',
] as const

export const noJavaScriptRoutes = [
  '/',
  '/build',
  '/start/install',
  '/reference/config/daemon',
  '/reference/api/categories/authentication',
  '/openapi/operations/list_projects',
  '/openapi/operations/upload_local_artifact',
] as const

export const staticEndpointRoutes = [
  '/api/navigation.json',
  '/api/search',
  '/openapi.json',
  '/robots.txt',
  '/sitemap.xml',
] as const

function operationRoutes(appDir: string) {
  const spec = JSON.parse(
    fs.readFileSync(path.join(appDir, 'public/openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, { operationId?: string } | undefined>>
  }

  return Object.values(spec.paths)
    .flatMap((pathItem) =>
      Object.entries(pathItem).flatMap(([method, operation]) =>
        httpMethods.has(method) && operation?.operationId
          ? [`/openapi/operations/${operation.operationId}`]
          : [],
      ),
    )
    .sort((left, right) => left.localeCompare(right))
}

function representativeRedirects(rules: RedirectRule[]) {
  const selected = [
    rules[0],
    rules.find((rule) => rule.source === '/openapi/'),
    rules.find((rule) => rule.source === '/reference/api/'),
    rules.at(-1),
  ].filter((rule): rule is RedirectRule => rule !== undefined)

  return [
    ...new Map(selected.map((rule) => [rule.source, rule])).values(),
  ].sort((left, right) => left.source.localeCompare(right.source))
}

export function createBrowserContract({
  appDir,
  repoDir,
}: {
  appDir: string
  repoDir: string
}) {
  const contract = readUrlContract(
    path.join(repoDir, 'wayfinder/public-docs-url-contract.md'),
  )
  const canonicals = [
    ...authoredCanonicals(contract).map((row) => row.path),
    ...OPENAPI_CATEGORIES.map(
      (category) => `/reference/api/categories/${category.slug}`,
    ),
    ...operationRoutes(appDir),
  ].sort((left, right) => left.localeCompare(right))
  const redirects = buildRedirectRules({
    canonicalPages: canonicals,
    contract,
  })
  const removed = sourceTerminals(contract)
    .filter((row) => row.response === 404)
    .map((row) => row.source)
    .sort((left, right) => left.localeCompare(right))
  const notFound = [
    '/unknown-authored-route',
    '/unknown-authored-route/',
    '/openapi/operations/not-an-operation',
    '/openapi/operations/not-an-operation/',
    '/reference/api/categories/not-a-category',
    '/reference/api/categories/not-a-category/',
    '/missing-static-asset.js',
    ...removed.flatMap((route) => [route, `${route}/`]),
  ]
  const representative = representativeRedirects(redirects)
  const requiredCases = [
    ...canonicals.flatMap((route) => [`GET:${route}`, `HEAD:${route}`]),
    ...notFound.flatMap((route) => [`404:GET:${route}`, `404:HEAD:${route}`]),
    ...representative.flatMap((rule) => [
      `redirect:GET:${rule.source}`,
      `redirect:HEAD:${rule.source}`,
    ]),
    ...staticEndpointRoutes.map((route) => `static:GET:${route}`),
    ...noJavaScriptRoutes.map((route) => `no-js:${route}`),
    ...browserInteractionCases,
  ].sort((left, right) => left.localeCompare(right))

  if (new Set(requiredCases).size !== requiredCases.length) {
    throw new Error('Browser acceptance contract contains duplicate cases')
  }

  return {
    canonicals,
    contract,
    notFound,
    redirects,
    representativeRedirects: representative,
    requiredCases,
  }
}
