import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const workflowPath = resolve(root, '.github/workflows/validate.yml')

type Workflow = {
  jobs: Record<string, WorkflowJob>
}

type WorkflowJob = {
  if?: string
  name?: string
  needs?: string | Array<string>
  env?: Record<string, string>
  steps?: Array<{
    id?: string
    if?: string
    run?: string
    uses?: string
    with?: Record<string, string>
  }>
}

type ValidationLane = 'docs' | 'frontend' | 'rust'

async function readWorkflow(): Promise<Workflow> {
  return Bun.YAML.parse(await Bun.file(workflowPath).text()) as Workflow
}

async function readPathFilters(): Promise<
  Record<ValidationLane, Array<string>>
> {
  const workflow = await readWorkflow()
  const filterStep = workflow.jobs.changes.steps?.find(
    (step) => step.id === 'filter',
  )
  const source = filterStep?.with?.filters
  if (!source) throw new Error('Validate workflow has no path filters')
  return Bun.YAML.parse(source) as Record<ValidationLane, Array<string>>
}

function routedLanes(
  filters: Record<ValidationLane, Array<string>>,
  changedPaths: Array<string>,
): Array<ValidationLane> {
  return (Object.keys(filters) as Array<ValidationLane>)
    .filter((lane) =>
      changedPaths.some((path) =>
        filters[lane].some((pattern) => new Bun.Glob(pattern).match(path)),
      ),
    )
    .sort()
}

function runRequiredResult(results: {
  changes: string
  docs: string
  frontend: string
  rust: string
}): Bun.SpawnSyncReturns<Uint8Array, Uint8Array> {
  return Bun.spawnSync({
    cmd: ['make', 'validate-required-result'],
    cwd: root,
    env: {
      ...process.env,
      CHANGES_RESULT: results.changes,
      DOCS_RESULT: results.docs,
      FRONTEND_RESULT: results.frontend,
      RUST_RESULT: results.rust,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

function dryRun(target: string): string {
  const result = Bun.spawnSync({
    cmd: ['make', '--dry-run', target],
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString())
  }
  return result.stdout.toString()
}

describe('pull-request validation contract', () => {
  test('routes representative changes to only their intended lanes', async () => {
    const filters = await readPathFilters()

    expect(routedLanes(filters, ['apps/web/src/main.tsx'])).toEqual([
      'frontend',
    ])
    expect(routedLanes(filters, ['tools/validate-standalone-web.sh'])).toEqual([
      'frontend',
    ])
    expect(
      routedLanes(filters, ['apps/docs-site/docs/guides/index.md']),
    ).toEqual(['docs'])
    expect(routedLanes(filters, ['CONTRIBUTING.md'])).toEqual(['docs'])
    expect(routedLanes(filters, ['tools/generate-release-index.ts'])).toEqual([
      'docs',
    ])
    expect(routedLanes(filters, ['crates/oored/src/lib.rs'])).toEqual(['rust'])
    expect(routedLanes(filters, ['shared/brand/og-image.svg'])).toEqual([
      'docs',
      'frontend',
    ])
    expect(routedLanes(filters, ['Makefile'])).toEqual([
      'docs',
      'frontend',
      'rust',
    ])
    expect(routedLanes(filters, ['.github/workflows/validate.yml'])).toEqual([
      'docs',
      'frontend',
      'rust',
    ])
    expect(
      routedLanes(filters, [
        'apps/web/src/main.tsx',
        'apps/docs-site/docs/guides/index.md',
        'crates/oored/src/lib.rs',
      ]),
    ).toEqual(['docs', 'frontend', 'rust'])
  })

  test('always reports one aggregate result for the conditional lanes', async () => {
    const workflow = await readWorkflow()
    const required = workflow.jobs.required

    expect(required.name).toBe('Required validation')
    expect(required.if).toBe('${{ always() }}')
    expect(required.needs).toEqual(['changes', 'frontend', 'docs', 'rust'])
    expect(
      required.steps?.some(
        (step) => step.run === 'make validate-required-result',
      ),
    ).toBe(true)
    expect(required.env).toEqual({
      CHANGES_RESULT: '${{ needs.changes.result }}',
      FRONTEND_RESULT: '${{ needs.frontend.result }}',
      DOCS_RESULT: '${{ needs.docs.result }}',
      RUST_RESULT: '${{ needs.rust.result }}',
    })
  })

  test('accepts successful or skipped lanes and rejects every other result', () => {
    expect(
      runRequiredResult({
        changes: 'success',
        frontend: 'success',
        docs: 'skipped',
        rust: 'skipped',
      }).exitCode,
    ).toBe(0)
    expect(
      runRequiredResult({
        changes: 'success',
        frontend: 'skipped',
        docs: 'success',
        rust: 'success',
      }).exitCode,
    ).toBe(0)
    expect(
      runRequiredResult({
        changes: 'success',
        frontend: 'skipped',
        docs: 'skipped',
        rust: 'skipped',
      }).exitCode,
    ).toBe(0)

    for (const result of [
      'failure',
      'cancelled',
      'timed_out',
      '',
      'unexpected',
    ]) {
      expect(
        runRequiredResult({
          changes: 'success',
          frontend: result,
          docs: 'skipped',
          rust: 'skipped',
        }).exitCode,
      ).not.toBe(0)
    }
    expect(
      runRequiredResult({
        changes: 'failure',
        frontend: 'skipped',
        docs: 'skipped',
        rust: 'skipped',
      }).exitCode,
    ).not.toBe(0)
  })
})

describe('local validation tiers', () => {
  test('keeps one lean pre-handoff graph and release-only acceptance', () => {
    const validate = dryRun('validate')
    const validatePr = dryRun('validate-pr')
    const scheduled = dryRun('validate-scheduled')
    const release = dryRun('validate-release')

    expect(validatePr).toBe(validate)
    expect(validate.match(/cd apps\/web && bun run build$/gm)).toHaveLength(1)
    expect(validate.match(/VITE_DEMO_MODE=true bun run build$/gm)).toHaveLength(
      1,
    )
    expect(validate).not.toContain('src/demo/demo.test.ts')
    expect(validate).not.toContain(
      '--all-targets --all-features --locked --no-run',
    )
    expect(validate).not.toContain('bash tools/release-smoke.sh')
    expect(validate).not.toContain('test:ui:scheduled')
    expect(scheduled).toContain('test:ui:scheduled')
    expect(release).toContain('bash tools/release-smoke.sh')
  })

  test('does not repeat browser setup, web builds, or Rust compilation in PR jobs', async () => {
    const workflow = await readWorkflow()
    const runs = Object.values(workflow.jobs).flatMap(
      (job) => job.steps?.flatMap((step) => (step.run ? [step.run] : [])) ?? [],
    )

    expect(
      runs.filter((run) => run.includes('playwright install')),
    ).toHaveLength(1)
    expect(
      runs.filter((run) => run === 'make bundle-check validate-web-launcher'),
    ).toHaveLength(1)
    expect(runs.filter((run) => run === 'make build-web')).toHaveLength(0)
    expect(
      runs.filter((run) => run === 'make validate-web-launcher'),
    ).toHaveLength(0)
    expect(runs.filter((run) => run === 'make compile-rust')).toHaveLength(0)

    expect(
      workflow.jobs.frontend.steps?.filter(
        (step) => step.run === 'make format-oxc-check',
      ),
    ).toHaveLength(1)
    expect(
      workflow.jobs.docs.steps?.filter(
        (step) =>
          step.run === 'make format-oxc-check' &&
          step.if === "needs.changes.outputs.frontend != 'true'",
      ),
    ).toHaveLength(1)
    expect(
      workflow.jobs.docs.steps?.some(
        (step) =>
          step.run ===
          'make test-docs test-validation-contract test-release-index',
      ),
    ).toBe(true)
  })
})
