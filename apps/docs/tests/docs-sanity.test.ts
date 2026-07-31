import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { OPENAPI_CATEGORIES } from '../src/lib/openapi-categories'

const appDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const urlContract = path.join(repoDir, 'wayfinder/public-docs-url-contract.md')
const docsDir = path.join(appDir, 'content/docs')
const publicDir = path.join(appDir, 'public')
const httpMethods = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
] as const
const pageStatuses = new Set([
  'implemented',
  'placeholder',
  'preview',
  'removed',
])
const nonBearerOperationIds = new Set([
  'download_local_artifact',
  'download_local_artifact_install',
  'download_local_artifact_legacy',
  'download_via_scoped_token',
  'download_via_scoped_token_v1',
  'frontend_pair',
  'get_ios_install_manifest',
  'get_ios_install_manifest_v1',
  'get_setup_status',
  'github_callback',
  'github_create_page',
  'github_installed',
  'github_webhook',
  'gitlab_callback',
  'gitlab_webhook',
  'healthz',
  'local_login',
  'metrics',
  'oidc_callback',
  'oidc_start',
  'readyz',
  'stream_build_logs',
  'trusted_proxy_login',
  'upload_local_artifact',
  'verify_bootstrap_token',
])
const additionHttpContract: Record<
  string,
  {
    headers?: string[]
    request?: string[]
    responses: Record<string, string[]>
    security: 'bearer' | 'none'
  }
> = {
  readyz: {
    responses: {
      '200': ['application/json'],
      '503': ['application/json'],
    },
    security: 'none',
  },
  metrics: {
    responses: { '200': ['text/plain'] },
    security: 'none',
  },
  record_web_performance: {
    request: ['application/json'],
    responses: {
      '204': [],
      '400': ['application/json'],
      '401': ['application/json'],
    },
    security: 'bearer',
  },
  github_create_page: {
    responses: {
      '200': ['text/html'],
      '400': [],
    },
    security: 'none',
  },
  github_callback: {
    responses: {
      '200': ['text/html'],
      '303': [],
    },
    security: 'none',
  },
  github_installed: {
    headers: ['Cookie'],
    responses: {
      '200': ['text/html'],
      '400': [],
    },
    security: 'none',
  },
  gitlab_callback: {
    responses: {
      '200': ['text/html'],
      '303': [],
    },
    security: 'none',
  },
  get_job_android_signing: {
    headers: ['x-oore-signing-token'],
    responses: {
      '200': ['application/json'],
      '401': ['application/json'],
      '403': ['application/json'],
      '404': ['application/json'],
      '409': ['application/json'],
      '500': ['application/json'],
    },
    security: 'bearer',
  },
  get_job_ios_signing: {
    headers: ['x-oore-signing-token'],
    responses: {
      '200': ['application/json'],
      '401': ['application/json'],
      '403': ['application/json'],
      '404': ['application/json'],
      '409': ['application/json'],
      '500': ['application/json'],
    },
    security: 'bearer',
  },
  upload_local_artifact: {
    request: ['application/octet-stream'],
    responses: {
      '200': [],
      '401': ['application/json'],
      '413': ['application/json'],
      '500': ['application/json'],
    },
    security: 'none',
  },
  download_local_artifact: {
    responses: {
      '200': ['application/octet-stream'],
      '404': ['application/json'],
      '500': ['application/json'],
    },
    security: 'none',
  },
  download_local_artifact_legacy: {
    responses: {
      '200': ['application/octet-stream'],
      '404': ['application/json'],
      '500': ['application/json'],
    },
    security: 'none',
  },
  download_via_scoped_token_v1: {
    responses: {
      '307': [],
      '401': ['application/json'],
      '410': ['application/json'],
      '500': ['application/json'],
      '503': ['application/json'],
    },
    security: 'none',
  },
  get_ios_install_manifest_v1: {
    responses: {
      '200': ['application/xml'],
      '401': ['application/json'],
      '404': ['application/json'],
      '410': ['application/json'],
      '412': ['application/json'],
      '422': ['application/json'],
      '500': ['application/json'],
    },
    security: 'none',
  },
  download_local_artifact_install: {
    responses: {
      '200': ['application/octet-stream'],
      '404': ['application/json'],
      '500': ['application/json'],
    },
    security: 'none',
  },
}

function markdownFiles(directory = docsDir): Array<string> {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(filePath)
    return /\.(?:md|mdx)$/.test(entry.name) ? [filePath] : []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function openApiOperationIds() {
  const spec = JSON.parse(
    fs.readFileSync(path.join(publicDir, 'openapi.json'), 'utf8'),
  ) as {
    components?: unknown
    paths?: unknown
    security?: unknown
    tags?: unknown
  }
  const issues: Array<string> = []
  const ids = new Set<string>()
  const methodPaths = new Set<string>()
  const operations: Array<{
    id: string
    method: string
    methodPath: string
    operation: Record<string, unknown>
    path: string
    tags: string[]
  }> = []
  const declaredTags = new Set<string>()
  const securitySchemes = new Set<string>()

  if (Array.isArray(spec.tags)) {
    for (const tag of spec.tags) {
      if (isRecord(tag) && typeof tag.name === 'string') {
        declaredTags.add(tag.name)
      }
    }
  }

  if (isRecord(spec.components) && isRecord(spec.components.securitySchemes)) {
    for (const name of Object.keys(spec.components.securitySchemes)) {
      securitySchemes.add(name)
    }
  }

  const validateSecurity = (security: unknown, owner: string) => {
    if (security === undefined) return
    if (!Array.isArray(security)) {
      issues.push(`${owner} -> security must be an array`)
      return
    }

    for (const requirement of security) {
      if (!isRecord(requirement)) {
        issues.push(`${owner} -> invalid security requirement`)
        continue
      }
      for (const scheme of Object.keys(requirement)) {
        if (!securitySchemes.has(scheme)) {
          issues.push(`${owner} -> unresolved security scheme ${scheme}`)
        }
      }
    }
  }

  validateSecurity(spec.security, 'openapi.json')

  if (!isRecord(spec.paths)) {
    return {
      ids,
      issues: ['openapi.json -> paths must be an object'],
      methodPaths,
      operations,
    }
  }

  for (const [route, pathItem] of Object.entries(spec.paths)) {
    if (!isRecord(pathItem)) {
      issues.push(`${route} -> path item must be an object`)
      continue
    }

    for (const method of httpMethods) {
      const operation = pathItem[method]
      if (operation === undefined) continue
      methodPaths.add(`${method.toUpperCase()} ${route}`)
      if (!isRecord(operation)) {
        issues.push(`${method.toUpperCase()} ${route} -> invalid operation`)
        continue
      }

      const operationId = operation.operationId
      if (typeof operationId !== 'string' || operationId.trim() === '') {
        issues.push(`${method.toUpperCase()} ${route} -> missing operationId`)
        continue
      }
      if (ids.has(operationId)) {
        issues.push(
          `${method.toUpperCase()} ${route} -> duplicate ${operationId}`,
        )
      }
      ids.add(operationId)

      const tags = Array.isArray(operation.tags)
        ? operation.tags.filter((tag): tag is string => typeof tag === 'string')
        : []
      operations.push({
        id: operationId,
        method: method.toUpperCase(),
        methodPath: `${method.toUpperCase()} ${route}`,
        operation,
        path: route,
        tags,
      })

      if (Array.isArray(operation.tags)) {
        for (const tag of operation.tags) {
          if (typeof tag === 'string' && !declaredTags.has(tag)) {
            issues.push(
              `${method.toUpperCase()} ${route} -> undeclared tag ${tag}`,
            )
          }
        }
      }

      validateSecurity(operation.security, `${method.toUpperCase()} ${route}`)
    }
  }

  if (ids.size === 0) issues.push('openapi.json -> no operations found')

  return { ids, issues, methodPaths, operations }
}

function acceptedOpenAPIOperations() {
  const contract = fs.readFileSync(urlContract, 'utf8')
  const preservedBlock = contract.match(
    /<!-- OPENAPI_OPERATION_URLS_BEGIN -->[\s\S]*?```text\n([\s\S]*?)\n```[\s\S]*?<!-- OPENAPI_OPERATION_URLS_END -->/,
  )?.[1]
  if (!preservedBlock) throw new Error('Missing preserved OpenAPI URL registry')

  const preserved = preservedBlock
    .split(/\r?\n/)
    .filter(Boolean)
    .map((url) => url.replace('/openapi/operations/', ''))

  const additions = new Map<
    string,
    { category: string; id: string; tag: string; url: string }
  >()
  for (const line of contract.split(/\r?\n/)) {
    const match = line.match(
      /^\| `([A-Z]+) ([^`]+)`\s+\| `([^`]+)`\s+\| `([^`]+)`\s+\| `([^`]+)` → ([^|]+?)\s+\|/,
    )
    if (!match) continue
    additions.set(`${match[1]} ${match[2]}`, {
      id: match[3],
      url: match[4],
      tag: match[5],
      category: match[6].trim(),
    })
  }
  if (additions.size === 0) {
    throw new Error('Missing OpenAPI parity appendix')
  }

  return { additions, preserved }
}

function acceptedCategoryMapping() {
  const mapping = new Map<string, string[]>()
  const contract = fs.readFileSync(urlContract, 'utf8')

  for (const line of contract.split(/\r?\n/)) {
    const columns = line.split('|').map((column) => column.trim())
    const slug = columns[2]?.match(
      /^`\/reference\/api\/categories\/([^`]+)`$/,
    )?.[1]
    if (!slug) continue

    const tags = [...(columns[3] ?? '').matchAll(/`([^`]+)`/g)].map(
      (match) => match[1],
    )
    if (tags.length === 0) {
      throw new Error(`Accepted OpenAPI category ${slug} has no tags`)
    }
    mapping.set(slug, tags)
  }

  if (mapping.size === 0) {
    throw new Error('Missing accepted OpenAPI category mapping')
  }
  return mapping
}

function openApiMappings(spec: unknown) {
  if (!isRecord(spec) || !isRecord(spec.paths)) {
    throw new Error('OpenAPI document has no paths')
  }

  const mappings = new Map<
    string,
    { id: string; method: string; path: string }
  >()
  for (const [route, pathItem] of Object.entries(spec.paths)) {
    if (!isRecord(pathItem)) continue
    for (const method of httpMethods) {
      const operation = pathItem[method]
      if (!isRecord(operation) || typeof operation.operationId !== 'string') {
        continue
      }
      mappings.set(operation.operationId, {
        id: operation.operationId,
        method: method.toUpperCase(),
        path: route,
      })
    }
  }
  return mappings
}

function baselineOpenApiMappings() {
  const baseline = execFileSync(
    'git',
    [
      'show',
      '66e56785394960f280b7c37244ed72b1dccca4bc:apps/docs/public/openapi.json',
    ],
    {
      cwd: repoDir,
      encoding: 'utf8',
    },
  )
  return openApiMappings(JSON.parse(baseline))
}

function contentTypes(value: unknown) {
  return isRecord(value) && isRecord(value.content)
    ? Object.keys(value.content).sort()
    : []
}

function responseMedia(operation: Record<string, unknown>) {
  if (!isRecord(operation.responses)) return {}
  return Object.fromEntries(
    Object.entries(operation.responses).map(([status, response]) => [
      status,
      contentTypes(response),
    ]),
  )
}

function requestMedia(operation: Record<string, unknown>) {
  return contentTypes(operation.requestBody)
}

function headerParameters(operation: Record<string, unknown>) {
  if (!Array.isArray(operation.parameters)) return []
  return operation.parameters
    .filter(
      (parameter) =>
        isRecord(parameter) &&
        parameter.in === 'header' &&
        typeof parameter.name === 'string',
    )
    .map((parameter) => parameter.name as string)
    .sort()
}

function balancedContents(
  source: string,
  openIndex: number,
  open: string,
  close: string,
) {
  let depth = 0
  let quote: string | undefined
  let escaped = false

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = undefined
      continue
    }
    if (character === '"') {
      quote = character
      continue
    }
    if (character === open) depth += 1
    else if (character === close) {
      depth -= 1
      if (depth === 0) return source.slice(openIndex + 1, index)
    }
  }

  throw new Error(`Unbalanced ${open}${close} block`)
}

function functionBody(source: string, name: string) {
  const declaration = source.indexOf(`fn ${name}`)
  if (declaration < 0) throw new Error(`Missing Rust function ${name}`)
  const open = source.indexOf('{', declaration)
  if (open < 0) throw new Error(`Missing Rust function body for ${name}`)
  return balancedContents(source, open, '{', '}')
}

function rustRouteMethodPaths(source: string) {
  const pairs = new Set<string>()
  const route = /\.route\s*\(/g

  for (let match = route.exec(source); match; match = route.exec(source)) {
    const open = source.indexOf('(', match.index)
    const call = balancedContents(source, open, '(', ')')
    const pathMatch = call.match(/^\s*"([^"]+)"/)
    if (!pathMatch) continue

    for (const method of call.matchAll(
      /(?:axum::routing::)?\b(delete|get|head|options|patch|post|put|trace)\s*\(/g,
    )) {
      const openApiPath = pathMatch[1].replace(/\{\*([^}]+)}/g, '{$1}')
      pairs.add(`${method[1].toUpperCase()} ${openApiPath}`)
    }
  }

  return pairs
}

function runtimeMethodPaths() {
  const lib = fs.readFileSync(
    path.join(repoDir, 'crates/oored/src/lib.rs'),
    'utf8',
  )
  const observability = fs.readFileSync(
    path.join(repoDir, 'crates/oored/src/observability.rs'),
    'utf8',
  )

  return new Set([
    ...rustRouteMethodPaths(functionBody(lib, 'build_router_inner')),
    ...rustRouteMethodPaths(functionBody(observability, 'metrics_router')),
  ])
}

function internalTargets(source: string) {
  const withoutCodeFences = source
    .split(/\r?\n/)
    .reduce(
      (state, line) => {
        const fence = line.match(/^\s*(`{3,}|~{3,})/)
        if (fence) {
          if (!state.fence) state.fence = fence[1][0]
          else if (state.fence === fence[1][0]) state.fence = undefined
          state.lines.push('')
        } else {
          state.lines.push(state.fence ? '' : line)
        }
        return state
      },
      { lines: [] as Array<string>, fence: undefined as string | undefined },
    )
    .lines.join('\n')
    .replace(/`[^`\n]*`/g, '')

  const targets: Array<string> = []
  const markdownLink =
    /!?\[[^\]]*]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*["'])?\s*\)/g
  const referenceDefinition = /^\s{0,3}\[[^\]]+]:\s*(?:<([^>]+)>|(\S+))/gm
  const htmlLink = /(?:href|src)=["']([^"']+)["']/g

  for (const match of withoutCodeFences.matchAll(markdownLink)) {
    targets.push(match[1] ?? match[2])
  }
  for (const match of withoutCodeFences.matchAll(referenceDefinition)) {
    targets.push(match[1] ?? match[2])
  }
  for (const match of withoutCodeFences.matchAll(htmlLink)) {
    targets.push(match[1])
  }

  return targets
}

function isInternalTarget(target: string) {
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(target)
}

function targetPath(sourceFile: string, target: string) {
  const cleanTarget = target.split(/[?#]/, 1)[0]
  if (!cleanTarget) return '/'

  const decodedTarget = decodeURIComponent(cleanTarget)
  if (decodedTarget.startsWith('/')) return path.posix.normalize(decodedTarget)

  const source = path
    .relative(docsDir, sourceFile)
    .split(path.sep)
    .join(path.posix.sep)

  return path.posix.normalize(
    path.posix.join('/', path.posix.dirname(source), decodedTarget),
  )
}

function internalTargetExists(
  sourceFile: string,
  target: string,
  operationIds = openApiOperationIds().ids,
) {
  let route: string
  try {
    route = targetPath(sourceFile, target)
  } catch {
    return false
  }

  if (route === '/') return fs.existsSync(path.join(docsDir, 'index.mdx'))

  const relative = route.replace(/^\//, '').replace(/\/$/, '')
  if (relative.startsWith('openapi/operations/')) {
    return operationIds.has(relative.slice('openapi/operations/'.length))
  }

  const candidates = [
    path.join(docsDir, relative),
    path.join(docsDir, `${relative}.md`),
    path.join(docsDir, `${relative}.mdx`),
    path.join(docsDir, relative, 'index.md'),
    path.join(docsDir, relative, 'index.mdx'),
    path.join(publicDir, relative),
  ]

  return candidates.some((candidate) => {
    try {
      return fs.statSync(candidate).isFile()
    } catch {
      return false
    }
  })
}

function metadataIssues(file: string) {
  const relative = path.relative(docsDir, file)
  const source = fs.readFileSync(file, 'utf8')
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) return [`${relative} -> missing YAML frontmatter`]

  let metadata: unknown
  try {
    metadata = parse(frontmatter[1])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [`${relative} -> ${message}`]
  }

  if (!isRecord(metadata)) {
    return [`${relative} -> frontmatter must be an object`]
  }

  const issues: Array<string> = []
  if (typeof metadata.title !== 'string' || metadata.title.trim() === '') {
    issues.push(`${relative} -> title must be a non-empty string`)
  }
  if (
    metadata.description !== undefined &&
    (typeof metadata.description !== 'string' ||
      metadata.description.trim() === '')
  ) {
    issues.push(`${relative} -> description must be a non-empty string`)
  }
  const status = metadata.status
  if (
    status !== undefined &&
    (typeof status !== 'string' || !pageStatuses.has(status))
  ) {
    const label = typeof status === 'string' ? status : JSON.stringify(status)
    issues.push(`${relative} -> unknown status ${label ?? typeof status}`)
  }

  return issues
}

describe('documentation publishing integrity', () => {
  it('resolves root-relative and relative authored links', () => {
    const operationIds = openApiOperationIds().ids
    const sourceFile = path.join(docsDir, 'guides/index.md')

    expect(
      internalTargetExists(
        sourceFile,
        '../getting-started/install',
        operationIds,
      ),
    ).toBe(true)
    expect(
      internalTargetExists(sourceFile, '/missing-page', operationIds),
    ).toBe(false)
    expect(
      internalTargets(
        '[Install][install]\n\n[install]: ../getting-started/install',
      ),
    ).toContain('../getting-started/install')
  })

  it('has valid authored page metadata', () => {
    expect(markdownFiles().flatMap(metadataIssues)).toEqual([])
  })

  it('has a valid generated OpenAPI operation contract', () => {
    expect(openApiOperationIds().issues).toEqual([])
  })

  it('keeps every baseline operation bound to its accepted method and path', () => {
    const baseline = baselineOpenApiMappings()
    const current = new Map(
      openApiOperationIds().operations.map((operation) => [
        operation.id,
        {
          id: operation.id,
          method: operation.method,
          path: operation.path,
        },
      ]),
    )

    expect(
      [...baseline.keys()].filter((operationId) => !current.has(operationId)),
    ).toEqual([])
    for (const [operationId, mapping] of baseline) {
      expect(current.get(operationId), operationId).toEqual(mapping)
    }
  })

  it('documents every production HTTP method and path exactly once', () => {
    const runtime = runtimeMethodPaths()
    const documented = openApiOperationIds().methodPaths

    expect([...runtime].filter((pair) => !documented.has(pair)).sort()).toEqual(
      [],
    )
    expect([...documented].filter((pair) => !runtime.has(pair)).sort()).toEqual(
      [],
    )
  })

  it('preserves accepted operation URLs and adds the reviewed parity matrix', () => {
    const accepted = acceptedOpenAPIOperations()
    const generated = openApiOperationIds()
    const expectedIds = new Set([
      ...accepted.preserved,
      ...[...accepted.additions.values()].map((operation) => operation.id),
    ])

    expect([...generated.ids].sort()).toEqual([...expectedIds].sort())
    for (const operation of generated.operations) {
      const addition = accepted.additions.get(operation.methodPath)
      if (!addition) continue
      expect(operation.id, operation.methodPath).toBe(addition.id)
      expect(operation.tags, operation.methodPath).toEqual([addition.tag])
      expect(`/openapi/operations/${operation.id}`, operation.methodPath).toBe(
        addition.url,
      )
      const category = OPENAPI_CATEGORIES.find((candidate) =>
        candidate.tags.some((tag) => tag === addition.tag),
      )
      expect(category?.title, operation.methodPath).toBe(addition.category)
    }
  })

  it('maps every generated operation tag through the accepted category table', () => {
    const generated = openApiOperationIds()
    const accepted = acceptedCategoryMapping()
    const usedTags = new Set(
      generated.operations.flatMap((operation) => operation.tags),
    )
    const mappedTags = new Set<string>(
      OPENAPI_CATEGORIES.flatMap((category) => category.tags),
    )

    expect(
      OPENAPI_CATEGORIES.map((category) => [category.slug, [...category.tags]]),
    ).toEqual([...accepted])
    expect([...usedTags].filter((tag) => !mappedTags.has(tag))).toEqual([])
    expect([...mappedTags].filter((tag) => !usedTags.has(tag))).toEqual([])

    for (const operation of generated.operations) {
      const categories = OPENAPI_CATEGORIES.filter((category) =>
        category.tags.some((tag) => operation.tags.includes(tag)),
      )
      expect(categories, operation.id).toHaveLength(1)
    }
  })

  it('matches the complete source-backed authentication classification', () => {
    const generated = openApiOperationIds()
    const operationIds = generated.ids
    const spec = JSON.parse(
      fs.readFileSync(path.join(publicDir, 'openapi.json'), 'utf8'),
    ) as { security?: unknown }

    expect(spec.security).toBeUndefined()
    expect(
      [...nonBearerOperationIds].filter(
        (operationId) => !operationIds.has(operationId),
      ),
    ).toEqual([])

    for (const operation of generated.operations) {
      if (nonBearerOperationIds.has(operation.id)) {
        expect(operation.operation.security, operation.id).toBeUndefined()
      } else {
        expect(operation.operation.security, operation.id).toEqual([
          { bearer_auth: [] },
        ])
      }
    }
  })

  it('keeps the accepted response status corrections', () => {
    const operations = new Map(
      openApiOperationIds().operations.map((operation) => [
        operation.id,
        operation.operation,
      ]),
    )

    expect(
      Object.keys(responseMedia(operations.get('register_runner')!)),
    ).toEqual(['200'])
    expect(
      Object.keys(responseMedia(operations.get('create_artifact')!)),
    ).toEqual(['200'])
  })

  it('matches the source-backed HTTP contract for every parity addition', () => {
    const accepted = acceptedOpenAPIOperations()
    const additions = new Set(
      [...accepted.additions.values()].map((operation) => operation.id),
    )
    const generated = new Map(
      openApiOperationIds().operations.map((operation) => [
        operation.id,
        operation.operation,
      ]),
    )

    expect(Object.keys(additionHttpContract).sort()).toEqual(
      [...additions].sort(),
    )
    for (const [operationId, expected] of Object.entries(
      additionHttpContract,
    )) {
      const operation = generated.get(operationId)
      expect(operation, operationId).toBeDefined()
      expect(requestMedia(operation!), `${operationId} request`).toEqual(
        expected.request ?? [],
      )
      expect(responseMedia(operation!), `${operationId} responses`).toEqual(
        expected.responses,
      )
      expect(headerParameters(operation!), `${operationId} headers`).toEqual(
        expected.headers ?? [],
      )
      expect(operation!.security, `${operationId} security`).toEqual(
        expected.security === 'bearer' ? [{ bearer_auth: [] }] : undefined,
      )
    }
  })

  it('exports the complete source-backed BuildContext fields', () => {
    const spec = JSON.parse(
      fs.readFileSync(path.join(publicDir, 'openapi.json'), 'utf8'),
    ) as unknown
    if (!isRecord(spec) || !isRecord(spec.components)) {
      throw new Error('OpenAPI document has no components')
    }
    const schemas = spec.components.schemas
    if (!isRecord(schemas) || !isRecord(schemas.BuildContext)) {
      throw new Error('OpenAPI document has no BuildContext schema')
    }
    const properties = schemas.BuildContext.properties
    if (!isRecord(properties)) {
      throw new Error('BuildContext has no properties')
    }

    for (const field of [
      'project_avatar_url',
      'repository_full_name',
      'repository_provider',
      'repository_host_url',
    ]) {
      expect(properties[field], field).toEqual({
        type: ['string', 'null'],
      })
    }
    expect(
      Array.isArray(schemas.BuildContext.required)
        ? schemas.BuildContext.required.filter((field) =>
            [
              'project_avatar_url',
              'repository_full_name',
              'repository_provider',
              'repository_host_url',
            ].includes(String(field)),
          )
        : [],
    ).toEqual([])
  })

  it('has no broken internal links in authored Markdown or MDX', () => {
    const broken = new Set<string>()
    const operationIds = openApiOperationIds().ids

    for (const file of markdownFiles()) {
      const source = fs.readFileSync(file, 'utf8')
      for (const target of internalTargets(source).filter(isInternalTarget)) {
        if (!internalTargetExists(file, target, operationIds)) {
          broken.add(`${path.relative(docsDir, file)} -> ${target}`)
        }
      }
    }

    expect([...broken].sort()).toEqual([])
  })

  it('does not proxy static assets through a Cloudflare Pages catch-all', () => {
    const rules = fs
      .readFileSync(path.join(publicDir, '_redirects'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/))

    expect(
      rules.filter(
        ([source, _destination, status]) => source === '/*' && status === '200',
      ),
    ).toEqual([])
  })

  it('uses the exact same shadcn registry configuration as apps/web', () => {
    const docsConfig = JSON.parse(
      fs.readFileSync(path.join(appDir, 'components.json'), 'utf8'),
    )
    const webConfig = JSON.parse(
      fs.readFileSync(path.join(appDir, '../web/components.json'), 'utf8'),
    )

    expect(docsConfig).toEqual(webConfig)
  })

  it('publishes valid shared visual assets and generated social artwork', () => {
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
      expect(
        fs.statSync(path.join(publicDir, asset)).size,
        asset,
      ).toBeGreaterThan(0)
    }

    const png = fs.readFileSync(path.join(publicDir, 'og-image.png'))
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])

    const svg = fs.readFileSync(path.join(publicDir, 'og-image.svg'), 'utf8')
    expect(svg).toMatch(
      /<svg\b[^>]*\bwidth="1200"[^>]*\bheight="630"[^>]*\bviewBox="0 0 1200 630"/,
    )
  })

  it('has a dark counterpart for every authored product screenshot', () => {
    const releaseChannels = fs.readFileSync(
      path.join(docsDir, 'operations/release-channels.md'),
      'utf8',
    )
    const screenshots = [
      ...releaseChannels.matchAll(/!\[[^\]]*]\((\/[^)]+\.png)\)/g),
    ].map((match) => match[1])

    expect(screenshots).not.toEqual([])
    for (const screenshot of screenshots) {
      const dark = screenshot.replace(/(\.[^./]+)$/, '-dark$1')
      expect(fs.statSync(path.join(publicDir, screenshot)).isFile()).toBe(true)
      expect(fs.statSync(path.join(publicDir, dark)).isFile()).toBe(true)
    }
  })
})
