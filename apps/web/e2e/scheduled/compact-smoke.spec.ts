import { expect, test } from '@playwright/test'

import { DEMO_PASSWORD } from '../../src/demo/seed'

test('QA release installation is usable at compact width', async ({ page }) => {
  await page.goto('/login')
  await expect(
    page.getByRole('heading', { name: 'Explore the Oore demo' }),
  ).toBeVisible()
  await page.getByLabel('Email').fill('demo+qa@oore.build')
  await page.getByLabel('Password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: /Sign in as/i }).click()
  await expect(page).toHaveURL(/\/$/)

  const currentRelease = page.getByRole('region', { name: 'Ready to test' })
  await expect(currentRelease).toBeVisible()
  await currentRelease.getByRole('button', { name: /^Android / }).click()
  await expect(page).toHaveURL(/\/builds\/[^/]+/)

  const installAction = page.getByRole('button', { name: 'Install' })
  await expect(installAction).toBeVisible()
  await expect(installAction).toBeEnabled()
})
