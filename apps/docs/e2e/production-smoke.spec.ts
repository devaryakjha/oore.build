import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import {
  browserInteractionCases,
  createBrowserContract,
  noJavaScriptRoutes,
  staticEndpointRoutes,
} from '../scripts/browser-contract'

const appDir = path.resolve(import.meta.dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const browserContract = createBrowserContract({ appDir, repoDir })
const requiredCases = new Set(browserContract.requiredCases)

function pass(caseId: string) {
  if (!requiredCases.has(caseId)) {
    throw new Error(`Unregistered browser acceptance case: ${caseId}`)
  }
  test.info().annotations.push({
    type: 'acceptance-case',
    description: caseId,
  })
}

function watchBrowser(page: Page) {
  const errors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`page: ${error.message}`)
  })
  page.on('requestfailed', (request) => {
    errors.push(
      `request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'failed'})`,
    )
  })

  return errors
}

test('representative deep routes contain their own content without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const pages = [
    ['/', 'Oore documentation'],
    ['/build', 'Build and distribute'],
    ['/start/install', 'Install Oore on one Mac'],
    ['/reference/config/daemon', 'Daemon configuration'],
    ['/reference/api/categories/authentication', 'Authentication'],
    ['/openapi/operations/list_projects', 'List projects'],
    [
      '/openapi/operations/upload_local_artifact',
      'Upload an artifact to local storage',
    ],
  ] as const

  expect(pages.map(([route]) => route)).toEqual([...noJavaScriptRoutes])
  for (const [route, heading] of pages) {
    const response = await page.goto(route)
    expect(response?.status(), route).toBe(200)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    await expect(page.locator('article')).not.toBeEmpty()
    pass(`no-js:${route}`)
  }

  await context.close()
})

test('unknown and removed routes render the real not-found document', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()

  for (const pathname of browserContract.notFound) {
    const response = await page.goto(pathname)
    expect(response?.status(), pathname).toBe(404)
    await expect(
      page.getByRole('heading', { level: 2, name: 'Page Not Found' }),
    ).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    )
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    await expect(
      page.getByText('Build, sign, and distribute Flutter apps'),
    ).toHaveCount(0)
  }

  pass('interaction:not-found-document')
  await context.close()
})

test('complete canonical inventory supports fresh GET and HEAD requests', async ({
  request,
}) => {
  for (const route of browserContract.canonicals) {
    const get = await request.get(route, { maxRedirects: 0 })
    expect(get.status(), `GET ${route}`).toBe(200)
    expect(get.headers()['content-type'], `GET ${route}`).toContain('text/html')
    pass(`GET:${route}`)

    const head = await request.head(route, { maxRedirects: 0 })
    expect(head.status(), `HEAD ${route}`).toBe(200)
    expect(head.headers()['content-type'], `HEAD ${route}`).toContain(
      'text/html',
    )
    pass(`HEAD:${route}`)
  }
})

test('redirect and not-found status contracts support GET and HEAD', async ({
  request,
}) => {
  for (const rule of browserContract.representativeRedirects) {
    for (const method of ['get', 'head'] as const) {
      const response = await request[method](rule.source, { maxRedirects: 0 })
      expect(response.status(), `${method.toUpperCase()} ${rule.source}`).toBe(
        301,
      )
      expect(response.headers().location, rule.source).toBe(rule.target)
      pass(`redirect:${method.toUpperCase()}:${rule.source}`)
    }
  }

  for (const route of browserContract.notFound) {
    for (const method of ['get', 'head'] as const) {
      const response = await request[method](route, { maxRedirects: 0 })
      expect(response.status(), `${method.toUpperCase()} ${route}`).toBe(404)
      pass(`404:${method.toUpperCase()}:${route}`)
    }
  }
})

test('static endpoints are direct build artifacts', async ({ request }) => {
  for (const route of staticEndpointRoutes) {
    const response = await request.get(route, { maxRedirects: 0 })
    expect(response.status(), route).toBe(200)
    expect((await response.body()).byteLength, route).toBeGreaterThan(0)
    pass(`static:GET:${route}`)
  }
})

test('desktop tree, breadcrumbs, previous-next, back, and reload agree', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.goto('/start/install')

  await expect(
    page.locator('#nd-sidebar').getByRole('link', {
      name: 'Install Oore on one Mac',
      exact: true,
    }),
  ).toHaveAttribute('data-active', 'true')
  await expect(
    page.getByRole('link', { name: 'Check that your Mac is ready' }).last(),
  ).toHaveAttribute('href', '/start/prerequisites')
  await expect(
    page.getByRole('link', { name: 'Open Oore for the first time' }).last(),
  ).toHaveAttribute('href', '/start/first-run')

  await page
    .getByRole('link', { name: 'Open Oore for the first time' })
    .last()
    .click()
  await expect(page).toHaveURL(/\/start\/first-run$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Open Oore for the first time',
    }),
  ).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://docs.oore.build/start/first-run',
  )
  pass('interaction:desktop-navigation')
  pass('interaction:metadata-navigation')

  await page.goBack()
  await expect(page).toHaveURL(/\/start\/install$/)
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Install Oore on one Mac' }),
  ).toBeVisible()
  pass('interaction:back-forward-reload')
  expect(errors).toEqual([])
})

test('static search returns unique authored and generated destinations', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.goto('/operate/maintain/backups/create')

  await page.locator('#nd-sidebar button[data-search-full]').click()
  const authoredSearch = page.getByRole('textbox', { name: 'Search' })
  await authoredSearch.fill('consistent SQLite snapshot')
  const authoredResult = page
    .getByRole('dialog', { name: 'Search' })
    .getByRole('button')
    .filter({ hasText: 'Create and verify a backup' })
  await expect(authoredResult).toHaveCount(1)
  await authoredResult.click()
  await expect(page).toHaveURL(/\/operate\/maintain\/backups\/create$/)
  pass('interaction:static-search-authored')

  await page.locator('#nd-sidebar button[data-search-full]').click()
  await page
    .getByRole('textbox', { name: 'Search' })
    .fill('POST /v1/api-tokens')
  const operationResult = page
    .getByRole('dialog', { name: 'Search' })
    .getByRole('button', { name: /Create API token$/ })
  await expect(operationResult).toHaveCount(1)
  await operationResult.click()
  await expect(page).toHaveURL(/\/openapi\/operations\/create_api_token$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create API token' }),
  ).toBeVisible()
  pass('interaction:static-search-operation')
  expect(errors).toEqual([])
})

test('light, dark, and system themes persist and follow system changes', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  await page.locator('button[aria-label="Dark"]:visible').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oore-docs-theme')))
    .toBe('dark')
  await expect(
    page.locator('img[src="/demo-dashboard.png"]').first(),
  ).toBeHidden()
  await expect(
    page.locator('img[src="/demo-dashboard-dark.png"]').first(),
  ).toBeVisible()

  await page.locator('button[aria-label="Light"]:visible').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oore-docs-theme')))
    .toBe('light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.locator('button[aria-label="System"]:visible').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oore-docs-theme')))
    .toBe('system')
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  pass('interaction:theme-light-dark-system')
  expect(errors).toEqual([])
})

test('authored fenced code uses the Fumadocs CodeBlock and Shiki', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.goto('/build/pipelines/oore-yaml')

  const block = page
    .locator('article figure.shiki')
    .filter({ hasText: 'version: 1' })
  await expect(block).toHaveCount(1)
  await expect(block.locator('pre')).toHaveClass(/min-w-full/)

  const versionToken = block
    .locator('code span[style*="--shiki-light"][style*="--shiki-dark"]')
    .filter({ hasText: 'version' })
  await expect(versionToken).toHaveCount(1)

  await page.locator('button[aria-label="Light"]:visible').click()
  const lightColor = await versionToken.evaluate(
    (element) => getComputedStyle(element).color,
  )
  await page.locator('button[aria-label="Dark"]:visible').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const darkColor = await versionToken.evaluate(
    (element) => getComputedStyle(element).color,
  )
  expect(darkColor).not.toBe(lightColor)

  await block.getByLabel('Copy Text').click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('version: 1')

  pass('interaction:authored-codeblock')
  expect(errors).toEqual([])
})

test('the live API tree drives category, tag, operation, tab, and copy behavior', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.goto('/reference/api')

  const sidebar = page.locator('#nd-sidebar')
  await expect(
    sidebar.getByRole('button', { name: 'API', exact: true }),
  ).toBeVisible()
  await expect(
    sidebar.getByRole('link', { name: 'HTTP API', exact: true }),
  ).toHaveAttribute('href', '/reference/api')
  await sidebar.getByRole('button', { name: 'Categories' }).click()
  await sidebar.getByRole('link', { name: 'Authentication' }).click()
  await expect(page).toHaveURL(/\/reference\/api\/categories\/authentication$/)

  await sidebar.getByRole('button', { name: 'Operations' }).click()
  await sidebar.getByRole('button', { name: 'Projects' }).click()
  await sidebar.getByRole('link', { name: /List projects/ }).click()
  await expect(page).toHaveURL(/\/openapi\/operations\/list_projects$/)

  const languageTabs = page.getByRole('tablist').filter({ hasText: 'cURL' })
  await languageTabs.getByRole('tab', { name: 'JavaScript' }).click()
  await expect(
    languageTabs.getByRole('tab', { name: 'JavaScript' }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('tabpanel').filter({ hasText: 'fetch(' }),
  ).toBeVisible()

  const responseTabs = page.getByRole('tablist').filter({ hasText: '400' })
  await responseTabs.getByRole('tab', { name: '400' }).click()
  await expect(responseTabs.getByRole('tab', { name: '400' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await languageTabs.getByRole('tab', { name: 'cURL' }).click()
  await page.getByLabel('Copy Text').first().click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('/v1/projects')
  pass('interaction:openapi-copy-tabs')
  expect(errors).toEqual([])
})

test('reduced-motion preference suppresses transition and animation timing', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/start/install')
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true)

  const maximumMotionMilliseconds = await page.evaluate(() => {
    const milliseconds = (value: string) =>
      value.split(',').map((part) => {
        const duration = part.trim()
        return duration.endsWith('ms')
          ? Number.parseFloat(duration)
          : Number.parseFloat(duration) * 1000
      })
    return Math.max(
      0,
      ...[...document.querySelectorAll('*')].flatMap((element) => {
        const style = getComputedStyle(element)
        return [
          ...milliseconds(style.animationDuration),
          ...milliseconds(style.transitionDuration),
        ]
      }),
    )
  })
  expect(maximumMotionMilliseconds).toBeLessThanOrEqual(0.01)
  pass('interaction:reduced-motion')
  expect(errors).toEqual([])
})

test.describe('mobile production preview', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile navigation preserves hierarchy and responsive access', async ({
    page,
  }) => {
    const errors = watchBrowser(page)
    await page.goto('/start/install')

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(pageWidth.client).toBe(390)
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client)

    const trigger = page.locator(
      'button[aria-controls="nd-sidebar-mobile"]:visible',
    )
    await expect(trigger).toHaveAccessibleName('Open Sidebar')
    await trigger.click()
    const mobile = page.locator('#nd-sidebar-mobile:visible')
    await expect(
      mobile.getByRole('link', {
        name: 'Install Oore on one Mac',
        exact: true,
      }),
    ).toHaveAttribute('data-active', 'true')
    await mobile
      .getByRole('link', { name: 'Open Oore for the first time' })
      .click()
    await expect(page).toHaveURL(/\/start\/first-run$/)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Open Oore for the first time',
      }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    pass('interaction:mobile-navigation')
    pass('interaction:responsive-accessibility')
    expect(errors).toEqual([])
  })
})

test('declared interaction registry is fully represented by named tests', () => {
  expect([...browserInteractionCases].sort()).toEqual(
    browserContract.requiredCases
      .filter((caseId) => caseId.startsWith('interaction:'))
      .sort(),
  )
})
