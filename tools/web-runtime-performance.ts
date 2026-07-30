import { performance } from 'node:perf_hooks'

import { groupLogs } from '../apps/web/src/components/terminal-log-viewer/log-model'
import { mergeBuildLogChunks } from '../apps/web/src/lib/log-stream-utils'
import type { BuildLogChunk } from '../apps/web/src/lib/types'

const LONG_TASK_MS = 50

export interface PerformanceEnvironment {
  platform: string
  arch: string
  bun: string
}

export interface RawPerformanceMeasurement {
  id: string
  label: string
  duration_ms: number
  budget_ms: number | null
}

export interface PerformanceMeasurement extends RawPerformanceMeasurement {
  previous_ms: number | null
  change_percent: number | null
  within_budget: boolean | null
}

export interface PerformanceReport {
  generated_at: string
  environment: PerformanceEnvironment
  baseline: {
    generated_at: string
    comparable: boolean
  } | null
  measurements: Array<PerformanceMeasurement>
  failures: Array<string>
}

interface CreatePerformanceReportOptions {
  generatedAt: string
  environment: PerformanceEnvironment
  baseline: PerformanceReport | null
  measurements: Array<RawPerformanceMeasurement>
}

function roundedChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1_000) / 10
}

export function createPerformanceReport({
  generatedAt,
  environment,
  baseline,
  measurements,
}: CreatePerformanceReportOptions): PerformanceReport {
  const comparable =
    baseline != null &&
    baseline.environment.platform === environment.platform &&
    baseline.environment.arch === environment.arch
  const previousById = new Map(
    comparable
      ? baseline.measurements.map((measurement) => [
          measurement.id,
          measurement.duration_ms,
        ])
      : [],
  )
  const reportedMeasurements = measurements.map((measurement) => {
    const previous = previousById.get(measurement.id) ?? null
    return {
      ...measurement,
      previous_ms: previous,
      change_percent:
        previous == null
          ? null
          : roundedChange(measurement.duration_ms, previous),
      within_budget:
        measurement.budget_ms == null
          ? null
          : measurement.duration_ms < measurement.budget_ms,
    }
  })

  return {
    generated_at: generatedAt,
    environment,
    baseline:
      baseline == null
        ? null
        : {
            generated_at: baseline.generated_at,
            comparable,
          },
    measurements: reportedMeasurements,
    failures: reportedMeasurements
      .filter((measurement) => measurement.within_budget === false)
      .map((measurement) => measurement.id),
  }
}

function formatDuration(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(2)} ms`
}

function formatChange(value: number | null): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatPerformanceSummary(
  report: PerformanceReport,
  baselineUrl?: string,
): string {
  const failed = report.failures.length > 0
  const baseline =
    report.baseline == null
      ? 'No previous scheduled report was available.'
      : report.baseline.comparable
        ? `Compared with ${baselineUrl ? `[the previous scheduled run](${baselineUrl})` : 'the previous scheduled run'} from ${report.baseline.generated_at}.`
        : 'The previous report used a different platform or architecture, so deltas were omitted.'
  const rows = report.measurements.map((measurement) => {
    const result =
      measurement.within_budget == null
        ? 'trend only'
        : measurement.within_budget
          ? 'within budget'
          : 'over budget'
    return `| ${measurement.label} | ${formatDuration(measurement.duration_ms)} | ${formatDuration(measurement.budget_ms)} | ${formatDuration(measurement.previous_ms)} | ${formatChange(measurement.change_percent)} | ${result} |`
  })

  return [
    '### Scheduled web runtime performance',
    '',
    `Result: **${failed ? 'failed' : 'passed'}**`,
    '',
    `Runner: \`${report.environment.platform}/${report.environment.arch}\`, Bun \`${report.environment.bun}\`.`,
    '',
    baseline,
    '',
    '| Measurement | Current | Budget | Previous | Change | Result |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...rows,
    '',
    'Budget failures fail this scheduled job. Run-to-run deltas are diagnostic because shared-runner variance is not a pull-request decision.',
    '',
  ].join('\n')
}

function measure(
  measurements: Array<RawPerformanceMeasurement>,
  id: string,
  label: string,
  run: () => void,
): number {
  const startedAt = performance.now()
  run()
  const duration = performance.now() - startedAt
  measurements.push({
    id,
    label,
    duration_ms: duration,
    budget_ms: LONG_TASK_MS,
  })
  console.log(`${label}: ${duration.toFixed(2)} ms / ${LONG_TASK_MS} ms`)
  return duration
}

async function loadBaseline(path: string | undefined) {
  if (!path) return null
  try {
    const candidate = (await Bun.file(
      path,
    ).json()) as Partial<PerformanceReport>
    if (
      !candidate.environment ||
      !Array.isArray(candidate.measurements) ||
      typeof candidate.generated_at !== 'string'
    ) {
      throw new Error('report shape is invalid')
    }
    return candidate as PerformanceReport
  } catch (error) {
    console.warn(
      `Ignoring unavailable performance baseline at ${path}: ${String(error)}`,
    )
    return null
  }
}

async function main() {
  const measurements: Array<RawPerformanceMeasurement> = []
  const projects = Array.from({ length: 200 }, (_, index) => ({
    id: `project-${index}`,
    name: `Project ${index}`,
  }))
  const builds = Array.from({ length: 20 }, (_, index) => ({
    projectId: `project-${index}`,
  }))

  measure(
    measurements,
    'project_lookup',
    'Build list project resolution (20 builds / 200 projects)',
    () => {
      for (const build of builds) {
        projects.find((project) => project.id === build.projectId)
      }
    },
  )

  const logs: Array<BuildLogChunk> = Array.from(
    { length: 10_000 },
    (_, sequence) => ({
      sequence,
      content:
        sequence % 997 === 0
          ? `error: generated failure ${sequence}`
          : `build output line ${sequence}`,
      stream: 'stdout',
    }),
  )

  let currentLogs: Array<BuildLogChunk> = []
  const logsBySequence = new Map<number, BuildLogChunk>()
  let worstFrame = 0
  const streamStartedAt = performance.now()
  for (let offset = 0; offset < logs.length; offset += 50) {
    const startedAt = performance.now()
    currentLogs = mergeBuildLogChunks(
      currentLogs,
      logsBySequence,
      logs.slice(offset, offset + 50),
    ).logs
    groupLogs(currentLogs, [])
    worstFrame = Math.max(worstFrame, performance.now() - startedAt)
  }
  const streamDuration = performance.now() - streamStartedAt
  measurements.push({
    id: 'live_log_total',
    label: 'Live log processing (10,000 lines, 50-line bursts)',
    duration_ms: streamDuration,
    budget_ms: null,
  })
  measurements.push({
    id: 'live_log_worst_frame',
    label: 'Live log worst frame',
    duration_ms: worstFrame,
    budget_ms: LONG_TASK_MS,
  })
  console.log(
    `Live log processing (10,000 lines, 50-line bursts): ${streamDuration.toFixed(2)} ms total; ${worstFrame.toFixed(2)} ms worst frame / ${LONG_TASK_MS} ms`,
  )

  measure(
    measurements,
    'terminal_search',
    'Terminal log grouping and search (10,000 lines)',
    () => {
      const grouped = groupLogs(currentLogs, [])
      grouped.allVisibleLogs.filter((entry) =>
        entry.content.toLowerCase().includes('failure'),
      )
    },
  )

  const users = Array.from({ length: 1_000 }, (_, index) => ({
    email: `user${index}@example.com`,
    status: index % 3 === 0 ? 'disabled' : 'active',
  }))

  measure(
    measurements,
    'admin_user_filter',
    'Admin user filter and sort (1,000 users)',
    () => {
      users
        .filter(
          (user) => user.email.includes('99') || user.status === 'disabled',
        )
        .sort((left, right) => left.email.localeCompare(right.email))
    },
  )

  const baseline = await loadBaseline(process.env.OORE_WEB_PERFORMANCE_BASELINE)
  const report = createPerformanceReport({
    generatedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      bun: Bun.version,
    },
    baseline,
    measurements,
  })
  const summary = formatPerformanceSummary(
    report,
    process.env.OORE_WEB_PERFORMANCE_BASELINE_URL,
  )

  if (process.env.OORE_WEB_PERFORMANCE_REPORT) {
    await Bun.write(
      process.env.OORE_WEB_PERFORMANCE_REPORT,
      `${JSON.stringify(report, null, 2)}\n`,
    )
  }
  if (process.env.OORE_WEB_PERFORMANCE_SUMMARY) {
    await Bun.write(process.env.OORE_WEB_PERFORMANCE_SUMMARY, summary)
  }

  if (report.failures.length > 0) {
    throw new Error(
      `Web runtime performance budgets exceeded: ${report.failures.join(', ')}`,
    )
  }
}

if (import.meta.main) {
  await main()
}
