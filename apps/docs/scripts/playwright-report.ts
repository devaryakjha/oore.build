export type JsonAnnotation = {
  description?: string
  type?: string
}

export type JsonTest = {
  annotations?: JsonAnnotation[]
  expectedStatus?: string
  results?: Array<{
    annotations?: JsonAnnotation[]
    retry?: number
    status?: string
  }>
  status?: string
}

type JsonSuite = {
  specs?: Array<{ tests?: JsonTest[] }>
  suites?: JsonSuite[]
}

export type PlaywrightJsonReport = {
  errors?: unknown[]
  suites?: JsonSuite[]
  stats?: {
    expected?: number
    flaky?: number
    skipped?: number
    unexpected?: number
  }
}

function reportTests(suites: JsonSuite[]): JsonTest[] {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests ?? []),
    ...reportTests(suite.suites ?? []),
  ])
}

export function passedPlaywrightTests(report: PlaywrightJsonReport) {
  const tests = reportTests(report.suites ?? [])
  const valid =
    report.stats !== undefined &&
    (report.stats.expected ?? 0) > 0 &&
    report.stats.flaky === 0 &&
    report.stats.skipped === 0 &&
    report.stats.unexpected === 0 &&
    (report.errors?.length ?? 0) === 0 &&
    tests.length === report.stats.expected &&
    tests.every(
      (test) =>
        test.status === 'expected' &&
        test.expectedStatus === 'passed' &&
        test.results?.length === 1 &&
        test.results[0]?.status === 'passed' &&
        test.results[0]?.retry === 0,
    )

  if (!valid) {
    throw new Error(
      `Invalid Playwright case inventory: ${JSON.stringify(report.stats)}`,
    )
  }
  return tests
}
