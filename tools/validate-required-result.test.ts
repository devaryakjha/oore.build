import { describe, expect, test } from 'bun:test'
import path from 'node:path'

const script = path.join(import.meta.dir, 'validate-required-result.sh')
const passingResults = {
  CHANGES_RESULT: 'success',
  TOOLING_RESULT: 'success',
  FRONTEND_RESULT: 'skipped',
  DOCS_RESULT: 'skipped',
  RUST_RESULT: 'skipped',
}

function evaluate(overrides: Record<string, string>) {
  const result = Bun.spawnSync({
    cmd: ['bash', script],
    cwd: path.join(import.meta.dir, '..'),
    env: { ...process.env, ...passingResults, ...overrides },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  }
}

describe('required validation result', () => {
  test('accepts skipped path-specific lanes after tooling succeeds', () => {
    const result = evaluate({})

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Required validation passed')
  })

  test('fails closed for unsuccessful aggregate inputs', () => {
    for (const [name, overrides] of [
      ['change detection failure', { CHANGES_RESULT: 'failure' }],
      ['path-specific failure', { FRONTEND_RESULT: 'failure' }],
      ['cancelled path-specific lane', { DOCS_RESULT: 'cancelled' }],
      ['skipped tooling lane', { TOOLING_RESULT: 'skipped' }],
      ['missing tooling result', { TOOLING_RESULT: '' }],
    ] as const) {
      const result = evaluate(overrides)

      expect(result.exitCode, name).not.toBe(0)
      expect(result.output, name).toContain('Required validation failed')
    }
  })
})
