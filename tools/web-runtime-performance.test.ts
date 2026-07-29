import { describe, expect, test } from 'bun:test'

import {
  createPerformanceReport,
  formatPerformanceSummary,
  type PerformanceReport,
} from './web-runtime-performance'

const previousReport: PerformanceReport = {
  generated_at: '2026-07-28T03:17:00.000Z',
  environment: {
    platform: 'linux',
    arch: 'x64',
    bun: '1.3.0',
  },
  baseline: null,
  measurements: [
    {
      id: 'project_lookup',
      label: 'Build list project resolution',
      duration_ms: 20,
      budget_ms: 50,
      previous_ms: null,
      change_percent: null,
      within_budget: true,
    },
    {
      id: 'live_log_worst_frame',
      label: 'Live log worst frame',
      duration_ms: 50,
      budget_ms: 50,
      previous_ms: null,
      change_percent: null,
      within_budget: false,
    },
  ],
  failures: ['live_log_worst_frame'],
}

describe('scheduled web runtime performance report', () => {
  test('reports comparable trends without letting variance erase budget failures', () => {
    const report = createPerformanceReport({
      generatedAt: '2026-07-29T03:17:00.000Z',
      environment: {
        platform: 'linux',
        arch: 'x64',
        bun: '1.3.1',
      },
      baseline: previousReport,
      measurements: [
        {
          id: 'project_lookup',
          label: 'Build list project resolution',
          duration_ms: 30,
          budget_ms: 50,
        },
        {
          id: 'live_log_worst_frame',
          label: 'Live log worst frame',
          duration_ms: 60,
          budget_ms: 50,
        },
      ],
    })

    expect(report.baseline).toEqual({
      generated_at: '2026-07-28T03:17:00.000Z',
      comparable: true,
    })
    expect(report.measurements).toEqual([
      {
        id: 'project_lookup',
        label: 'Build list project resolution',
        duration_ms: 30,
        budget_ms: 50,
        previous_ms: 20,
        change_percent: 50,
        within_budget: true,
      },
      {
        id: 'live_log_worst_frame',
        label: 'Live log worst frame',
        duration_ms: 60,
        budget_ms: 50,
        previous_ms: 50,
        change_percent: 20,
        within_budget: false,
      },
    ])
    expect(report.failures).toEqual(['live_log_worst_frame'])

    const summary = formatPerformanceSummary(
      report,
      'https://github.com/oore-ci/oore.build/actions/runs/123',
    )
    expect(summary).toContain('| Build list project resolution | 30.00 ms |')
    expect(summary).toContain('| Live log worst frame | 60.00 ms |')
    expect(summary).toContain('+50.0%')
    expect(summary).toContain('actions/runs/123')
    expect(summary).toContain('Result: **failed**')
  })

  test('does not compare measurements collected on a different runner shape', () => {
    const report = createPerformanceReport({
      generatedAt: '2026-07-29T03:17:00.000Z',
      environment: {
        platform: 'darwin',
        arch: 'arm64',
        bun: '1.3.1',
      },
      baseline: previousReport,
      measurements: [
        {
          id: 'project_lookup',
          label: 'Build list project resolution',
          duration_ms: 30,
          budget_ms: 50,
        },
      ],
    })

    expect(report.baseline).toEqual({
      generated_at: '2026-07-28T03:17:00.000Z',
      comparable: false,
    })
    expect(report.measurements[0]?.previous_ms).toBeNull()
    expect(report.measurements[0]?.change_percent).toBeNull()
  })
})
