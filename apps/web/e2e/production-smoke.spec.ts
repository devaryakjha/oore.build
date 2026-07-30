import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { DEMO_PASSWORD } from '../src/demo/seed'

const PERSONAS = {
  owner: 'demo+owner@oore.build',
  qa: 'demo+qa@oore.build',
} as const

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await expect(
    page.getByRole('heading', { name: 'Explore the Oore demo' }),
  ).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: /Sign in as/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('Owner dashboard and QA release installation are usable', async ({
  page,
}) => {
  await signIn(page, PERSONAS.owner)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'System status' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Build activity' }),
  ).toBeVisible()

  await page.getByRole('button', { name: /demo\+owner@oore\.build/i }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, PERSONAS.qa)
  const currentRelease = page.getByRole('region', { name: 'Ready to test' })
  await expect(currentRelease).toBeVisible()
  await currentRelease.getByRole('button', { name: /^Android / }).click()
  await expect(page).toHaveURL(/\/builds\/[^/]+/)

  const installAction = page
    .getByRole('button', { name: 'Download APK' })
    .filter({ visible: true })
  await expect(installAction).toBeVisible()
  await expect(installAction).toBeEnabled()
})
