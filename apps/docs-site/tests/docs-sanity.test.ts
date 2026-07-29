import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const appDir = path.resolve(__dirname, '..')
const docsDir = path.join(appDir, 'docs')
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
  ) as { paths?: unknown }
  const issues: Array<string> = []
  const ids = new Set<string>()

  if (!isRecord(spec.paths)) {
    return { ids, issues: ['openapi.json -> paths must be an object'] }
  }

  for (const [route, pathItem] of Object.entries(spec.paths)) {
    if (!isRecord(pathItem)) {
      issues.push(`${route} -> path item must be an object`)
      continue
    }

    for (const method of httpMethods) {
      const operation = pathItem[method]
      if (operation === undefined) continue
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
    }
  }

  if (ids.size === 0) issues.push('openapi.json -> no operations found')

  return { ids, issues }
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

  it('provides the static deep-link fallback required by Cloudflare Pages', () => {
    const rules = fs
      .readFileSync(path.join(publicDir, '_redirects'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/))

    expect(rules).toContainEqual(['/*', '/_shell.html', '200'])
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
      'demo-builds.webp',
      'demo-dashboard.webp',
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
})
