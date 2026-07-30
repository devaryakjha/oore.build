import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { DEMO_PASSWORD } from '../../src/demo/seed'
import { PERFORMANCE_MARKS } from '../../src/lib/performance-marks'

type PerformanceProfile = 'pr' | 'local' | 'scheduled'

interface BrowserPerformanceSample {
  scenario: string
  repetition: number
  fixture: Record<string, number>
  route: string
  surface: string
  timings: {
    routeToUsefulContentMs: number | null
    routeToInteractionReadyMs: number | null
    navigationResponseMs: number | null
    navigationDomContentLoadedMs: number | null
    navigationLoadMs: number | null
  }
  browser: {
    domNodeCount: number
    heapUsedBytes: number | null
    longTaskCount: number
    longTaskTotalMs: number
    longestTaskMs: number
    eventCount: number
    longestEventMs: number
  }
  structure?: Record<string, number>
  interaction?: {
    name: string
    durationMs: number
  }
}

const requestedProfile = process.env.OORE_PERF_PROFILE
const profile: PerformanceProfile =
  requestedProfile === 'pr' ||
  requestedProfile === 'scheduled' ||
  requestedProfile === 'local'
    ? requestedProfile
    : 'local'
const repetitions = profile === 'scheduled' ? 3 : 1
const logFixtures = profile === 'pr' ? [10_000] : [10_000, 100_000]
const samples: Array<BrowserPerformanceSample> = []

function performanceUrl(
  path: string,
  fixture: Record<string, number> = {},
): string {
  const url = new URL(path, 'http://127.0.0.1:4173')
  url.searchParams.set('oorePerf', '1')
  for (const [key, value] of Object.entries(fixture)) {
    url.searchParams.set(key, String(value))
  }
  return `${url.pathname}${url.search}`
}

async function installBrowserObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const entries = {
      events: [] as Array<Record<string, number | string>>,
      longTasks: [] as Array<Record<string, number | string>>,
    }
    Reflect.set(window, '__oorePerformanceObserverEntries', entries)

    const observe = (
      target: Array<Record<string, number | string>>,
      options: PerformanceObserverInit,
    ) => {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            target.push({
              duration: entry.duration,
              name: entry.name,
              startTime: entry.startTime,
            })
          }
        })
        observer.observe(options)
      } catch {
        // Unsupported entry types remain explicit as empty arrays in the report.
      }
    }

    observe(entries.longTasks, {
      type: 'longtask',
      buffered: true,
    })
    observe(entries.events, {
      type: 'event',
      buffered: true,
      durationThreshold: 16,
    })
  })
}

async function signIn(page: Page, email: string): Promise<void> {
  await installBrowserObservers(page)
  await page.goto(performanceUrl('/login'))
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: /Sign in as/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function waitForMark(
  page: Page,
  name: string,
  surface: string,
): Promise<void> {
  await page.waitForFunction(
    ({ markName, markSurface }) =>
      performance.getEntriesByName(markName).some((entry) => {
        const detail = (entry as PerformanceMark).detail as
          | Record<string, unknown>
          | undefined
        return detail?.surface === markSurface
      }),
    { markName: name, markSurface: surface },
  )
}

async function measureInteraction(
  page: Page,
  name: string,
  action: () => Promise<void>,
  settled: () => Promise<void>,
): Promise<number> {
  const startMark = `oore:harness:${name}:start`
  const endMark = `oore:harness:${name}:end`
  await page.evaluate((mark) => performance.mark(mark), startMark)
  await action()
  await settled()
  return page.evaluate(
    ({ end, start }) => {
      performance.mark(end)
      return performance.measure(`oore:harness:${start}`, start, end).duration
    },
    { end: endMark, start: startMark },
  )
}

async function captureSurface({
  fixture,
  interaction,
  page,
  repetition,
  route,
  scenario,
  structure,
  surface,
}: {
  fixture?: Record<string, number>
  interaction?: BrowserPerformanceSample['interaction']
  page: Page
  repetition: number
  route: string
  scenario: string
  structure?: Record<string, number>
  surface: string
}): Promise<void> {
  await waitForMark(page, PERFORMANCE_MARKS.usefulContent, surface)
  await waitForMark(page, PERFORMANCE_MARKS.interactionReady, surface)

  const measurement = await page.evaluate(
    ({ interactionMark, routePath, usefulMark, targetSurface }) => {
      const mark = (name: string) =>
        performance
          .getEntriesByName(name)
          .filter((entry) => {
            const detail = (entry as PerformanceMark).detail as
              | Record<string, unknown>
              | undefined
            return detail?.surface === targetSurface
          })
          .at(-1) as PerformanceMark | undefined
      const routeStart = (
        performance.getEntriesByName(
          'oore:route:start',
        ) as Array<PerformanceMark>
      )
        .filter(
          (entry) =>
            (entry.detail as Record<string, unknown> | undefined)?.path ===
            routePath,
        )
        .at(-1)
      const useful = mark(usefulMark)
      const interactive = mark(interactionMark)
      const navigation = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined
      const observed = Reflect.get(
        window,
        '__oorePerformanceObserverEntries',
      ) as
        | {
            events: Array<{ duration: number }>
            longTasks: Array<{ duration: number }>
          }
        | undefined
      const memory = Reflect.get(performance, 'memory') as
        | { usedJSHeapSize?: number }
        | undefined
      const longTaskDurations =
        observed?.longTasks.map((entry) => entry.duration) ?? []
      const eventDurations =
        observed?.events.map((entry) => entry.duration) ?? []

      return {
        browser: {
          domNodeCount: document.getElementsByTagName('*').length,
          eventCount: eventDurations.length,
          heapUsedBytes: memory?.usedJSHeapSize ?? null,
          longestEventMs: Math.max(0, ...eventDurations),
          longestTaskMs: Math.max(0, ...longTaskDurations),
          longTaskCount: longTaskDurations.length,
          longTaskTotalMs: longTaskDurations.reduce(
            (total, duration) => total + duration,
            0,
          ),
        },
        timings: {
          navigationDomContentLoadedMs:
            navigation?.domContentLoadedEventEnd ?? null,
          navigationLoadMs: navigation?.loadEventEnd ?? null,
          navigationResponseMs: navigation?.responseEnd ?? null,
          routeToInteractionReadyMs:
            routeStart && interactive
              ? interactive.startTime - routeStart.startTime
              : null,
          routeToUsefulContentMs:
            routeStart && useful
              ? useful.startTime - routeStart.startTime
              : null,
        },
      }
    },
    {
      interactionMark: PERFORMANCE_MARKS.interactionReady,
      routePath: route,
      targetSurface: surface,
      usefulMark: PERFORMANCE_MARKS.usefulContent,
    },
  )

  samples.push({
    scenario,
    repetition,
    fixture: fixture ?? {},
    route,
    surface,
    ...measurement,
    ...(structure ? { structure } : {}),
    ...(interaction ? { interaction } : {}),
  })
}

test.afterAll(async () => {
  const outputPath = resolve(
    process.cwd(),
    process.env.OORE_PERF_OUTPUT ??
      `dist/performance/browser-${profile}-prototype.json`,
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        profile,
        generatedAt: new Date().toISOString(),
        policy: {
          hardGates: [
            'required lifecycle marks are present',
            'collections mount one representation per record',
            'large log fixtures mount at most 200 log rows',
          ],
          trendOnly: [
            'route readiness timings',
            'interaction timings',
            'long tasks',
            'heap usage',
            'DOM node counts',
          ],
          universalScore: null,
        },
        samples,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
})

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  test(`operator collection · repetition ${repetition}`, async ({ page }) => {
    await signIn(page, 'demo+owner@oore.build')
    const fixture = { oorePerfBuilds: 200 }
    await page.goto(performanceUrl('/builds?pageSize=100', fixture))
    await waitForMark(
      page,
      PERFORMANCE_MARKS.interactionReady,
      'builds-collection',
    )

    const structure = await page.evaluate(() => {
      const records = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-oore-performance-collection-item]',
        ),
      )
      return {
        hiddenCollectionRepresentations: records.filter(
          (record) => record.offsetParent === null,
        ).length,
        mountedCollectionRepresentations: records.length,
        uniqueCollectionRecords: new Set(
          records.map(
            (record) => record.dataset.oorePerformanceCollectionItem ?? '',
          ),
        ).size,
      }
    })
    expect(structure.mountedCollectionRepresentations).toBe(
      structure.uniqueCollectionRecords,
    )
    expect(structure.hiddenCollectionRepresentations).toBe(0)
    await captureSurface({
      fixture,
      page,
      repetition,
      route: '/builds',
      scenario: 'operator-collection',
      structure,
      surface: 'builds-collection',
    })
  })

  test(`entity detail · repetition ${repetition}`, async ({ page }) => {
    await signIn(page, 'demo+owner@oore.build')
    await page.goto(performanceUrl('/builds/build-demo-004'))
    await captureSurface({
      page,
      repetition,
      route: '/builds/build-demo-004',
      scenario: 'entity-detail',
      surface: 'build-detail',
    })
  })

  test(`settings form · repetition ${repetition}`, async ({ page }) => {
    await signIn(page, 'demo+owner@oore.build')
    await page.goto(performanceUrl('/settings/preferences'))
    await waitForMark(
      page,
      PERFORMANCE_MARKS.interactionReady,
      'preferences-form',
    )
    const durationMs = await measureInteraction(
      page,
      'preferences-network-editor',
      () =>
        page
          .locator(
            '[data-oore-performance-action="preferences-network-editor"]',
          )
          .click(),
      () => expect(page.getByRole('dialog')).toBeVisible(),
    )
    await captureSurface({
      interaction: { name: 'open-network-editor', durationMs },
      page,
      repetition,
      route: '/settings/preferences',
      scenario: 'settings-form',
      surface: 'preferences-form',
    })
  })

  test(`QA release hub · repetition ${repetition}`, async ({ page }) => {
    await signIn(page, 'demo+qa@oore.build')
    await page.goto(performanceUrl('/'))
    await captureSurface({
      page,
      repetition,
      route: '/',
      scenario: 'qa-release-hub',
      surface: 'qa-release-hub',
    })
  })

  for (const logCount of logFixtures) {
    test(`log workbench ${logCount} rows · repetition ${repetition}`, async ({
      page,
    }) => {
      await signIn(page, 'demo+owner@oore.build')
      const fixture = { oorePerfLogs: logCount }
      await page.goto(performanceUrl('/builds/build-demo-004', fixture))
      await waitForMark(
        page,
        PERFORMANCE_MARKS.firstVisibleLogRows,
        'build-log-workbench',
      )
      const mountedLogRowsBeforeFilter = await page
        .locator('[data-index]')
        .count()
      const durationMs = await measureInteraction(
        page,
        `log-search-${logCount}`,
        () =>
          page
            .locator('[data-oore-performance-action="log-search"]')
            .fill(`fixture line ${String(logCount - 1).padStart(6, '0')}`),
        () =>
          waitForMark(
            page,
            PERFORMANCE_MARKS.logFilterReady,
            'build-log-workbench',
          ),
      )
      const structure = await page.evaluate(() => ({
        mountedLogRowsAfterFilter:
          document.querySelectorAll('[data-index]').length,
      }))
      expect(mountedLogRowsBeforeFilter).toBeLessThanOrEqual(200)
      await captureSurface({
        fixture,
        interaction: { name: 'filter-last-log-row', durationMs },
        page,
        repetition,
        route: '/builds/build-demo-004',
        scenario: `log-workbench-${logCount}`,
        structure: { mountedLogRowsBeforeFilter, ...structure },
        surface: 'build-log-workbench',
      })
    })
  }

  test(`stream update · repetition ${repetition}`, async ({ page }) => {
    await signIn(page, 'demo+owner@oore.build')
    const fixture = { oorePerfStreamLogs: 1_500 }
    await page.goto(performanceUrl('/builds/build-demo-001', fixture))
    await waitForMark(
      page,
      PERFORMANCE_MARKS.streamUpdateComplete,
      'build-log-workbench',
    )
    await captureSurface({
      fixture,
      page,
      repetition,
      route: '/builds/build-demo-001',
      scenario: 'log-stream-update',
      surface: 'build-log-workbench',
    })
  })
}
