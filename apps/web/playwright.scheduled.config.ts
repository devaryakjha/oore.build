import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './dist/playwright-results/scheduled',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    [
      'html',
      {
        open: 'never',
        outputFolder: './dist/playwright-report/scheduled',
      },
    ],
    [
      'junit',
      {
        outputFile: './dist/playwright-results/scheduled/junit.xml',
      },
    ],
  ],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'firefox-desktop-light',
      testMatch: /production-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'webkit-desktop-light',
      testMatch: /production-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-compact-dark',
      testMatch: /scheduled\/compact-smoke\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: 'bun run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/login',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
