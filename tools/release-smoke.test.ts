import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
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

async function runReleaseSmoke(failMake = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'oore-release-smoke-'))
  temporaryRoots.push(root)
  const fakeMake = path.join(root, 'make')
  await writeFile(
    fakeMake,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${RELEASE_SMOKE_TEST_FAIL:-}" == "1" ]]; then
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
      RELEASE_SMOKE_TEST_FAIL: failMake ? '1' : '0',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  }
}

describe('release smoke', () => {
  test('reports successful hermetic work and keeps live checks explicit', async () => {
    const result = await runReleaseSmoke()

    expect(result.exitCode).toBe(0)
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
    const result = await runReleaseSmoke(true)

    expect(result.exitCode).toBe(19)
    expect(result.output).toContain('Hermetic release acceptance failed')
    expect(result.output).not.toContain('Hermetic release acceptance passed')
  })
})
