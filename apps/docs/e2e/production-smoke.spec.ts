import { expect, test, type Page } from '@playwright/test'

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

test('deep static routes and unknown paths work without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()

  let response = await page.goto('/getting-started/install')
  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Install Oore CI' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Install on one Mac (default)',
    }),
  ).toBeVisible()

  response = await page.goto('/reference/api/categories/authentication')
  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Authentication' }),
  ).toBeVisible()
  await expect(
    page.getByText('/v1/api-tokens', { exact: true }).first(),
  ).toBeVisible()

  response = await page.goto('/openapi/operations/list_projects')
  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', { level: 1, name: 'List projects' }),
  ).toBeVisible()
  await expect(page.getByText('/v1/projects', { exact: true })).toBeVisible()
  await expect(page.getByText('GET', { exact: true }).first()).toBeVisible()

  response = await page.goto('/openapi/operations/upload_local_artifact')
  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Upload an artifact to local storage',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('/v1/artifacts/local-upload/{token}', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('PUT', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText('upload_local_artifact', { exact: true }),
  ).toBeVisible()

  for (const pathname of [
    '/this-page-does-not-exist',
    '/this-page-does-not-exist/',
    '/openapi/operations/not-an-operation',
    '/openapi/operations/not-an-operation/',
    '/reference/api/categories/not-a-category',
    '/reference/api/categories/not-a-category/',
    '/missing-static-asset.js',
  ]) {
    response = await page.goto(pathname)
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

  await context.close()
})

test('static search is served with its intended media type', async ({
  request,
}) => {
  const response = await request.get('/api/search')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe(
    'application/json; charset=utf-8',
  )
  expect(await response.json()).toEqual(expect.any(Object))
})

test('desktop navigation, search, and theme persist across transitions', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/getting-started/install')

  await page.getByRole('link', { name: 'Set Up Your Instance' }).first().click()
  await expect(page).toHaveURL(/\/getting-started\/first-instance$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Set Up Your Instance' }),
  ).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/getting-started\/install$/)
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Install Oore CI' }),
  ).toBeVisible()

  await page.getByLabel('Toggle Theme').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oore-docs-theme')))
    .toBe('dark')

  await page.goto('/operations/release-channels')
  await expect(page.locator('.oore-theme-image-light').first()).toBeHidden()
  await expect(page.locator('.oore-theme-image-dark').first()).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.locator('#nd-sidebar button[data-search-full]').click()
  const search = page.getByRole('textbox', { name: 'Search' })
  await expect(search).toBeVisible()
  await search.fill('Install Oore CI')
  const result = page
    .getByRole('dialog', { name: 'Search' })
    .getByRole('button', {
      name: 'Oore CI documentation Get started Install Oore CI',
      exact: true,
    })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/\/getting-started\/install$/)

  await page.locator('#nd-sidebar button[data-search-full]').click()
  await page
    .getByRole('textbox', { name: 'Search' })
    .fill('POST /v1/api-tokens')
  const operation = page
    .getByRole('dialog', { name: 'Search' })
    .getByRole('button', {
      name: /Create API token$/,
    })
  await expect(operation).toHaveCount(1)
  await operation.click()
  await expect(page).toHaveURL(/\/openapi\/operations\/create_api_token$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Create API token',
    }),
  ).toBeVisible()

  expect(errors).toEqual([])
})

test('one page tree drives API navigation and OpenAPI interactions', async ({
  page,
}) => {
  const errors = watchBrowser(page)
  await page.goto('/reference/api')

  const sidebar = page.locator('#nd-sidebar')
  await expect(sidebar.getByText('HTTP API', { exact: true })).toBeVisible()
  await expect(
    sidebar.getByRole('link', { name: 'OpenAPI reference' }),
  ).toBeVisible()
  await sidebar.getByRole('button', { name: 'Categories' }).click()
  await expect(
    sidebar.getByRole('link', { name: 'Authentication' }),
  ).toBeVisible()
  await sidebar.getByRole('link', { name: 'Authentication' }).click()
  await expect(page).toHaveURL(/\/reference\/api\/categories\/authentication$/)

  const operations = sidebar.getByRole('button', { name: 'Operations' })
  await expect(operations).toBeVisible()
  await operations.click()
  const listProjects = sidebar.getByRole('link', { name: /List projects/ })
  await expect(listProjects).toBeVisible()
  await listProjects.click()
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

  await page.goBack()
  await expect(page).toHaveURL(/\/reference\/api\/categories\/authentication$/)
  await page.reload()

  expect(errors).toEqual([])
})

test.describe('mobile production preview', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('navigation survives navigation, back, and reload', async ({ page }) => {
    const errors = watchBrowser(page)
    await page.goto('/getting-started/install')

    await page
      .locator('button[aria-controls="nd-sidebar-mobile"]:visible')
      .click()
    await page
      .locator('#nd-sidebar-mobile:visible')
      .getByRole('link', { name: 'Set Up Your Instance' })
      .click()
    await expect(page).toHaveURL(/\/getting-started\/first-instance$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Set Up Your Instance' }),
    ).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/getting-started\/install$/)
    await page.reload()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Install Oore CI' }),
    ).toBeVisible()

    expect(errors).toEqual([])
  })
})
