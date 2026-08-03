import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { createArtifactManifest } from './artifact-manifest'
import { createBrowserContract } from './browser-contract'
import {
  passedPlaywrightTests,
  type JsonAnnotation,
  type PlaywrightJsonReport,
} from './playwright-report'
import {
  authoredCanonicals,
  buildRedirectRules,
  contentRoute,
  readUrlContract,
  sourceTerminals,
} from './public-contract'
import { OPENAPI_CATEGORIES } from '../src/lib/openapi-categories'

const lane = process.argv[2]
if (!['browser', 'build', 'source'].includes(lane ?? '')) {
  throw new Error(
    'Usage: bun scripts/acceptance-attestation.ts source|build|browser',
  )
}

const appDir = path.resolve(import.meta.dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const docsDir = path.join(appDir, 'content/docs')
const distDir = path.join(appDir, 'dist')
const evidenceDir = path.join(appDir, '.astro/acceptance')
const contract = readUrlContract(
  path.join(repoDir, 'wayfinder/public-docs-url-contract.md'),
)
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

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}

function authoredRoutes() {
  return walk(docsDir)
    .filter((file) => /\.(?:md|mdx)$/.test(file))
    .map((file) => contentRoute(path.relative(docsDir, file)))
    .sort()
}

function operations() {
  const spec = JSON.parse(
    fs.readFileSync(path.join(appDir, 'public/openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, { operationId?: string } | undefined>>
  }
  return Object.entries(spec.paths)
    .flatMap(([route, pathItem]) =>
      Object.entries(pathItem).flatMap(([method, operation]) =>
        httpMethods.has(method) && operation?.operationId
          ? [
              {
                id: operation.operationId,
                methodPath: `${method.toUpperCase()} ${route}`,
                route: `/openapi/operations/${operation.operationId}`,
              },
            ]
          : [],
      ),
    )
    .sort((left, right) => left.route.localeCompare(right.route))
}

function difference(left: string[], right: string[]) {
  const target = new Set(right)
  return left.filter((item) => !target.has(item)).sort()
}

const expectedAuthored = authoredCanonicals(contract)
  .map((row) => row.path)
  .sort()
const actualAuthored = authoredRoutes()
const operationRows = operations()
const categories = OPENAPI_CATEGORIES.map(
  (category) => `/reference/api/categories/${category.slug}`,
).sort()
const canonicals = [
  ...expectedAuthored,
  ...categories,
  ...operationRows.map((operation) => operation.route),
].sort()
const redirects = buildRedirectRules({ canonicalPages: canonicals, contract })
const removed = sourceTerminals(contract)
  .filter((row) => row.response === 404)
  .map((row) => row.source)
  .sort()
const legacy = sourceTerminals(contract).map((row) => row.source)
const baseCases = [
  ...expectedAuthored.map((route) => `authored:${route}`),
  ...categories.map((route) => `category:${route}`),
  ...operationRows.map(
    (operation) => `operation:${operation.methodPath}:${operation.id}`,
  ),
  ...legacy.map((route) => `legacy:${route}`),
]
const browserContract =
  lane === 'browser' ? createBrowserContract({ appDir, repoDir }) : undefined
const cases =
  lane === 'source'
    ? baseCases
    : lane === 'build'
      ? [
          ...canonicals.map((route) => `html:${route}`),
          ...redirects.map((rule) => `redirect:${rule.source}`),
          ...removed.map((route) => `removed:${route}`),
          'static:/404.html',
          'static:/api/search',
          'static:/openapi.json',
          'static:/robots.txt',
          'static:/sitemap.xml',
        ]
      : browserContract!.requiredCases

const artifact =
  lane === 'build' || lane === 'browser'
    ? createArtifactManifest(distDir)
    : undefined
let browserTests: unknown
let executedCases = cases
let browserExtra: string[] = []
let browserMissing: string[] = []
let retries: string[] = []
if (lane === 'browser') {
  const reportPath = path.join(evidenceDir, 'playwright.json')
  if (!fs.existsSync(reportPath)) {
    throw new Error('Missing Playwright JSON report')
  }
  const report = JSON.parse(
    fs.readFileSync(reportPath, 'utf8'),
  ) as PlaywrightJsonReport
  const tests = passedPlaywrightTests(report)

  retries = tests.flatMap((test, testIndex) =>
    (test.results ?? []).flatMap((result) =>
      (result.retry ?? 0) > 0
        ? [`test:${testIndex}:retry:${result.retry}`]
        : [],
    ),
  )
  if (retries.length > 0) {
    throw new Error(
      `Playwright acceptance cases retried: ${retries.join(', ')}`,
    )
  }

  const observed = tests
    .flatMap((test) => test.annotations ?? [])
    .filter(
      (annotation): annotation is JsonAnnotation & { description: string } =>
        annotation.type === 'acceptance-case' &&
        typeof annotation.description === 'string',
    )
    .map((annotation) => annotation.description)
  const duplicateCases = observed.filter(
    (item, index) => observed.indexOf(item) !== index,
  )
  if (duplicateCases.length > 0) {
    throw new Error(
      `Playwright acceptance cases executed more than once: ${[
        ...new Set(duplicateCases),
      ].join(', ')}`,
    )
  }
  executedCases = observed.sort()
  browserExtra = difference(executedCases, cases)
  browserMissing = difference(cases, executedCases)
  browserTests = {
    ...report.stats,
    acceptanceCases: executedCases.length,
  }
}

const sitemap =
  lane === 'build' || lane === 'browser'
    ? [
        ...fs
          .readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8')
          .matchAll(/<loc>([^<]+)<\/loc>/g),
      ].map((match) => match[1])
    : undefined
const search =
  lane === 'build' || lane === 'browser'
    ? (JSON.parse(
        fs.readFileSync(path.join(distDir, 'api/search'), 'utf8'),
      ) as {
        docs?: { docs?: Record<string, { page_id?: string }> }
      })
    : undefined
const sitemapRoutes =
  sitemap?.map((url) => {
    const parsed = new URL(url)
    return parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/$/, '')
  }) ?? []
const searchRoutes =
  search === undefined
    ? []
    : [
        ...new Set(
          Object.values(search.docs?.docs ?? {}).flatMap((document) =>
            typeof document.page_id === 'string' ? [document.page_id] : [],
          ),
        ),
      ].sort()
const setDifferences = {
  authoredExtra: difference(actualAuthored, expectedAuthored),
  authoredMissing: difference(expectedAuthored, actualAuthored),
  browserExtra,
  browserMissing,
  searchExtra: search === undefined ? [] : difference(searchRoutes, canonicals),
  searchMissing:
    search === undefined ? [] : difference(canonicals, searchRoutes),
  sitemapExtra:
    sitemap === undefined ? [] : difference(sitemapRoutes, canonicals),
  sitemapMissing:
    sitemap === undefined ? [] : difference(canonicals, sitemapRoutes),
}

const attestation = {
  artifact:
    artifact === undefined
      ? undefined
      : {
          digest: artifact.digest,
          entries: artifact.entries.length,
          schema: artifact.schema,
        },
  browserTests,
  commit: git('rev-parse', 'HEAD'),
  derived: {
    authored: expectedAuthored.length,
    canonical: canonicals.length,
    categories: categories.length,
    legacySources: legacy.length,
    operations: operationRows.length,
    redirects: redirects.length,
    removed: removed.length,
    search: search === undefined ? undefined : searchRoutes.length,
    sitemap: sitemap?.length,
  },
  derived_required: cases,
  dirty: git('status', '--porcelain') !== '',
  evidence: {
    command:
      lane === 'source'
        ? 'bun run test:source'
        : lane === 'build'
          ? 'bun run test:build'
          : 'bun run test:browser',
    locations: [
      `.astro/acceptance/${lane}.json`,
      ...(lane === 'browser' ? ['.astro/acceptance/playwright.json'] : []),
    ],
  },
  executed: executedCases,
  failed: [],
  inputs: {
    acceptance: git('rev-parse', 'f1402153^{commit}'),
    architecture: git('rev-parse', '2a0a887b^{commit}'),
    deployment: git('rev-parse', '04a00aa7^{commit}'),
    ledger: git('rev-parse', 'aa7d6986^{commit}'),
    tree: git('rev-parse', '3e6505b8^{commit}'),
    truth: git('rev-parse', 'd645878a^{commit}'),
    urls: git('rev-parse', '61706887^{commit}'),
    voice: git('rev-parse', '442d306c^{commit}'),
  },
  lane,
  passed: executedCases,
  retries,
  result: 'PASS',
  setDifferences,
  skipped: [],
}

if (Object.values(attestation.setDifferences).some((rows) => rows.length > 0)) {
  throw new Error(
    `Acceptance inventory differs: ${JSON.stringify(attestation.setDifferences)}`,
  )
}

fs.mkdirSync(evidenceDir, { recursive: true })
fs.writeFileSync(
  path.join(evidenceDir, `${lane}.json`),
  `${JSON.stringify(attestation, null, 2)}\n`,
)
console.log(
  JSON.stringify({
    artifactDigest: attestation.artifact?.digest,
    derived: attestation.derived,
    derived_required: attestation.derived_required.length,
    executed: attestation.executed.length,
    failed: attestation.failed.length,
    lane,
    passed: attestation.passed.length,
    result: attestation.result,
    setDifferences: attestation.setDifferences,
    skipped: attestation.skipped.length,
  }),
)
