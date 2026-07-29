import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const appDir = path.resolve(__dirname, '..')
const docsDir = path.join(appDir, 'docs')
const publicDir = path.join(appDir, 'public')

function markdownFiles(directory = docsDir): Array<string> {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(filePath)
    return /\.(?:md|mdx)$/.test(entry.name) ? [filePath] : []
  })
}

function openApiOperationIds() {
  const spec = JSON.parse(
    fs.readFileSync(path.join(publicDir, 'openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, { operationId?: string }>>
  }

  return new Set(
    Object.values(spec.paths).flatMap((pathItem) =>
      Object.values(pathItem)
        .map((operation) => operation.operationId)
        .filter((operationId): operationId is string => Boolean(operationId)),
    ),
  )
}

function routeExists(route: string) {
  const cleanRoute = route.split(/[?#]/, 1)[0]
  if (!cleanRoute || cleanRoute === '/') {
    return fs.existsSync(path.join(docsDir, 'index.mdx'))
  }

  const relative = decodeURIComponent(
    cleanRoute.replace(/^\//, '').replace(/\/$/, ''),
  )
  const candidates = [
    path.join(docsDir, `${relative}.md`),
    path.join(docsDir, `${relative}.mdx`),
    path.join(docsDir, relative, 'index.md'),
    path.join(docsDir, relative, 'index.mdx'),
    path.join(publicDir, relative),
  ]

  if (relative.startsWith('openapi/operations/')) {
    const operationId = relative.slice('openapi/operations/'.length)
    return openApiOperationIds().has(operationId)
  }

  return candidates.some((candidate) => fs.existsSync(candidate))
}

describe('documentation structure', () => {
  it('keeps the primary task and reference entry points', () => {
    const requiredPages = [
      'index.mdx',
      'getting-started/index.md',
      'getting-started/install.md',
      'guides/index.md',
      'reference/index.md',
      'reference/config/installer.md',
      'openapi/index.md',
      'operations/index.md',
      'operations/known-limitations.md',
      'operations/troubleshooting.md',
    ]

    for (const page of requiredPages) {
      expect(fs.existsSync(path.join(docsDir, page)), page).toBe(true)
    }
  })

  it('gives every authored page Fumadocs title frontmatter', () => {
    const missingTitles = markdownFiles()
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8')
        const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)
        return !frontmatter?.[1].match(/^title:\s*.+$/m)
      })
      .map((file) => path.relative(docsDir, file))

    expect(missingTitles).toEqual([])
  })

  it('has no broken root-relative links in authored Markdown', () => {
    const broken: Array<string> = []
    const markdownLink = /\[[^\]]*\]\((\/[^)\s]+)(?:\s+['"][^)]*['"])?\)/g
    const htmlLink = /href=["'](\/[^"']+)["']/g

    for (const file of markdownFiles()) {
      const source = fs.readFileSync(file, 'utf8')
      for (const pattern of [markdownLink, htmlLink]) {
        pattern.lastIndex = 0
        for (const match of source.matchAll(pattern)) {
          if (!routeExists(match[1])) {
            broken.push(`${path.relative(docsDir, file)} -> ${match[1]}`)
          }
        }
      }
    }

    expect(broken).toEqual([])
  })

  it('keeps generated OpenAPI as the only API contract', () => {
    const overview = fs.readFileSync(
      path.join(docsDir, 'openapi/index.md'),
      'utf8',
    )
    expect(overview).not.toContain('<OASpec')

    const apiDir = path.join(docsDir, 'reference/api')
    for (const file of fs
      .readdirSync(apiDir)
      .filter((name) => name.endsWith('.md'))) {
      const source = fs.readFileSync(path.join(apiDir, file), 'utf8')
      expect(source, file).not.toMatch(/^### (Request|Response|Path|Query)/m)
    }
  })

  it('generates OpenAPI pages through the Fumadocs source', () => {
    const openapi = fs.readFileSync(
      path.join(appDir, 'src/lib/openapi.ts'),
      'utf8',
    )
    const source = fs.readFileSync(
      path.join(appDir, 'src/lib/source.ts'),
      'utf8',
    )
    const page = fs.readFileSync(
      path.join(appDir, 'src/components/api-page.tsx'),
      'utf8',
    )

    expect(openapi).toContain("input: ['./public/openapi.json']")
    expect(source).toContain("baseDir: 'openapi/operations'")
    expect(source).toContain('openapi.loaderPlugin()')
    expect(page).toContain("from 'fumadocs-openapi/ui'")
  })

  it('builds a static SPA with Cloudflare Pages deep-link fallback', () => {
    const viteConfig = fs.readFileSync(
      path.join(appDir, 'vite.config.ts'),
      'utf8',
    )
    const redirects = fs.readFileSync(
      path.join(publicDir, '_redirects'),
      'utf8',
    )
    const searchRoute = fs.readFileSync(
      path.join(appDir, 'src/routes/api/search.ts'),
      'utf8',
    )

    expect(viteConfig).toContain('spa:')
    expect(viteConfig).toContain('enabled: true')
    expect(viteConfig).toContain("import mdx from 'fumadocs-mdx/vite'")
    expect(viteConfig).toContain('authoredPagePaths()')
    expect(viteConfig).toContain('openApiPagePaths()')
    expect(redirects).toContain('/* /_shell.html 200')
    expect(searchRoute).toContain('server.staticGET()')
    expect(fs.existsSync(path.join(docsDir, '.vitepress'))).toBe(false)
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

  it('reuses the canonical brand and responsive product screenshots', () => {
    const webPublicDir = path.join(appDir, '../web/public')
    const siteProductDir = path.join(appDir, '../site/public/product')

    for (const asset of [
      'favicon.ico',
      'logo.svg',
      'logo192.png',
      'logo512.png',
      'og-image.png',
      'og-image.svg',
    ]) {
      expect(fs.realpathSync(path.join(publicDir, asset))).toBe(
        fs.realpathSync(path.join(webPublicDir, asset)),
      )
    }

    for (const screenshot of ['dashboard', 'builds']) {
      expect(
        fs.realpathSync(path.join(publicDir, `demo-${screenshot}.webp`)),
      ).toBe(
        fs.realpathSync(
          path.join(siteProductDir, `demo-${screenshot}-1200.webp`),
        ),
      )
    }
  })

  it('generates the shared Open Graph artwork with Satori', () => {
    const generator = fs.readFileSync(
      path.join(appDir, '../../tools/generate-og-images.tsx'),
      'utf8',
    )
    const generatedSvg = fs.readFileSync(
      path.join(appDir, '../../shared/brand/og-image.svg'),
      'utf8',
    )
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }

    expect(generator).toContain("import satori from 'satori'")
    expect(generator).toContain("from '@resvg/resvg-js'")
    expect(generator).toContain('demo-dashboard.png')
    expect(generatedSvg).toContain('Generated by tools/generate-og-images.tsx')
    expect(packageJson.scripts.build).toContain(
      'materialize-docs-static-assets.ts',
    )
  })

  it('documents the managed Direct runner service and update verification', () => {
    const install = fs.readFileSync(
      path.join(docsDir, 'getting-started/install.md'),
      'utf8',
    )
    expect(install).toContain(
      'installs the daemon and runner as boot-time services',
    )
    expect(install).toContain(
      'verifies backend readiness and the runner heartbeat',
    )
    expect(install).not.toContain('Remote runner updates are not available yet')
  })

  it('uses the canonical Direct runner policy controls', () => {
    const runnerGuide = fs.readFileSync(
      path.join(docsDir, 'guides/runners/external-runner.md'),
      'utf8',
    )
    expect(runnerGuide).toContain('Settings > Runners')
    expect(runnerGuide).toContain('Settings > Preferences')
    expect(runnerGuide).not.toContain(
      'runner status in **Settings > Preferences**',
    )
  })

  it('uses per-route canonical metadata', () => {
    const loader = fs.readFileSync(
      path.join(appDir, 'src/lib/page-loader.ts'),
      'utf8',
    )
    expect(loader).toContain("property: 'og:url'")
    expect(loader).toContain("rel: 'canonical'")
  })
})
