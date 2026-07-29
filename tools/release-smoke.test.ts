import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  )
})

async function runReleaseSmoke(failingTarget?: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'oore-release-smoke-'))
  temporaryRoots.push(root)
  const calls = path.join(root, 'make-calls')
  const fakeMake = path.join(root, 'make')
  await writeFile(
    fakeMake,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$RELEASE_SMOKE_TEST_CALLS"
if [[ "\${1:-}" == "\${RELEASE_SMOKE_TEST_FAIL_TARGET:-}" ]]; then
  exit 19
fi
`,
  )
  await chmod(fakeMake, 0o755)

  const result = Bun.spawnSync({
    cmd: ['bash', path.join(import.meta.dir, 'release-smoke.sh')],
    cwd: path.join(import.meta.dir, '..'),
    env: {
      ...process.env,
      PATH: `${root}:${process.env.PATH ?? ''}`,
      RELEASE_SMOKE_TEST_CALLS: calls,
      RELEASE_SMOKE_TEST_FAIL_TARGET: failingTarget ?? '',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
    calls: (await readFile(calls, 'utf8').catch(() => ''))
      .trim()
      .split('\n')
      .filter(Boolean),
  }
}

describe('release smoke', () => {
  test('runs the hermetic release lanes and keeps live checks explicit', async () => {
    const result = await runReleaseSmoke()

    expect(result.exitCode).toBe(0)
    expect(result.calls).toEqual([
      'test-release-automation',
      'test-install',
      'test-release-upgrade',
      'test-release-artifacts',
    ])
    expect(result.output).toContain('Hermetic release acceptance passed')
    for (const dependency of [
      'credentialed macOS runner',
      'signing',
      'source provider',
      'object storage',
      'email',
      'external network',
      'assistive technology',
      'actual device',
    ]) {
      expect(result.output).toContain(
        `[live acceptance] NOT RUN: ${dependency}`,
      )
    }
  })

  test('does not claim success after a hermetic lane fails', async () => {
    const result = await runReleaseSmoke('test-release-upgrade')

    expect(result.exitCode).toBe(19)
    expect(result.calls).toEqual([
      'test-release-automation',
      'test-install',
      'test-release-upgrade',
    ])
    expect(result.output).toContain('Hermetic release acceptance failed')
    expect(result.output).not.toContain('Hermetic release acceptance passed')
  })
})
