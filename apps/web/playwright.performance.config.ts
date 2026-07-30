import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/performance',
  testMatch: /browser-performance\.prototype\.spec\.ts/,
  outputDir: './dist/playwright-performance-results',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    launchOptions: {
      args: ['--enable-precise-memory-info'],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'bun run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/login',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
