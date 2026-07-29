import { defineConfig } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  outputDir: './dist/playwright-results',
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  reporter: 'line',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    screenshot: 'off',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'bun run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/login',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
