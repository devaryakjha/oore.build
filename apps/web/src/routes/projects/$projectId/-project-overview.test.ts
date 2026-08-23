import { describe, expect, test } from 'bun:test'
import type { Artifact, Build } from '@oore/client/models'

import {
  deriveProjectHealth,
  newestProjectBuild,
  resolveProjectTab,
  selectInstallableProjectArtifacts,
  selectProjectActivity,
} from './-project-overview'

function build(
  buildNumber: number,
  status: Build['status'],
  queuedAt = buildNumber,
): Build {
  return {
    branch: 'main',
    build_number: buildNumber,
    config_snapshot: {},
    created_at: queuedAt,
    id: `build-${buildNumber}`,
    pipeline_id: 'pipeline-1',
    project_id: 'project-1',
    queued_at: queuedAt,
    status,
    trigger_type: 'manual',
    updated_at: queuedAt,
  }
}

function artifact({
  buildId,
  createdAt,
  expiresAt,
  id,
  type,
}: {
  buildId: string
  createdAt: number
  expiresAt?: number
  id: string
  type: Artifact['artifact_type']
}): Artifact {
  return {
    artifact_type: type,
    build_id: buildId,
    created_at: createdAt,
    expires_at: expiresAt,
    file_path: id,
    id,
    metadata:
      type === 'ipa'
        ? {
            ios_app: {
              build_number: '10',
              bundle_identifier: 'build.oore.test',
              display_name: 'Test',
              version: '1.0',
            },
            ios_signing: {
              bundle_ids: ['build.oore.test'],
              effective_export_method: 'release-testing',
            },
          }
        : {},
    name: id,
    state: 'available',
  }
}

describe('project tabs', () => {
  test('uses Overview for a missing or invalid tab', () => {
    expect(resolveProjectTab(undefined)).toBe('overview')
    expect(resolveProjectTab('unknown')).toBe('overview')
  })

  test('preserves direct links to peer tabs', () => {
    expect(resolveProjectTab('builds')).toBe('builds')
    expect(resolveProjectTab('pipelines')).toBe('pipelines')
    expect(resolveProjectTab('settings')).toBe('settings')
  })
})

describe('project Overview selection', () => {
  test('defines the latest build by greatest project build number', () => {
    expect(
      newestProjectBuild([build(11, 'running', 200), build(12, 'failed', 100)])
        ?.build_number,
    ).toBe(12)
  })

  test('surfaces missing and unavailable source states before build state', () => {
    const base = {
      buildQueryFailed: false,
      latestBuild: build(12, 'running'),
      pipelineCount: 1,
      runnerPaused: false,
      runnerStatusFailed: false,
    }

    expect(
      deriveProjectHealth({
        ...base,
        hasSourceLink: false,
        sourceAvailable: false,
      }),
    ).toMatchObject({
      title: 'No source repository',
      action: 'source-settings',
    })
    expect(
      deriveProjectHealth({
        ...base,
        hasSourceLink: true,
        sourceAvailable: false,
      }),
    ).toMatchObject({
      title: 'Source repository unavailable',
      label: 'Blocked',
    })
  })

  test('distinguishes no-pipeline, no-build, and active states', () => {
    const base = {
      buildQueryFailed: false,
      hasSourceLink: true,
      runnerPaused: false,
      runnerStatusFailed: false,
      sourceAvailable: true,
    }

    expect(deriveProjectHealth({ ...base, pipelineCount: 0 })).toMatchObject({
      title: 'No pipeline configured',
      action: 'pipelines',
    })
    expect(deriveProjectHealth({ ...base, pipelineCount: 1 })).toMatchObject({
      title: 'No build history yet',
      label: 'Ready to run',
    })
    expect(
      deriveProjectHealth({
        ...base,
        latestBuild: build(12, 'running'),
        pipelineCount: 1,
      }),
    ).toMatchObject({ title: 'Build #12 is running', label: 'Building' })
  })

  test('orders active builds before recent terminal builds and caps the list', () => {
    const selected = selectProjectActivity(
      [
        build(9, 'failed', 90),
        build(8, 'running', 80),
        build(7, 'succeeded', 70),
        build(6, 'queued', 60),
        build(5, 'timed_out', 50),
        build(4, 'canceled', 40),
      ],
      5,
    )

    expect(selected.map(({ build_number }) => build_number)).toEqual([
      8, 6, 9, 7, 5,
    ])
  })

  test('reports a runner block before a queued build as ordinary activity', () => {
    const latestBuild = {
      ...build(12, 'queued'),
      runner_policy_block_reason: 'instance_paused' as const,
    }

    expect(
      deriveProjectHealth({
        buildQueryFailed: false,
        hasSourceLink: true,
        latestBuild,
        pipelineCount: 1,
        runnerPaused: false,
        runnerStatusFailed: false,
        sourceAvailable: true,
      }),
    ).toMatchObject({ label: 'Blocked', action: 'runner-settings' })
  })

  test('keeps a failed latest build as the primary health signal', () => {
    expect(
      deriveProjectHealth({
        buildQueryFailed: false,
        hasSourceLink: true,
        latestBuild: build(12, 'failed'),
        pipelineCount: 1,
        runnerPaused: false,
        runnerStatusFailed: false,
        sourceAvailable: true,
      }),
    ).toMatchObject({ label: 'Needs attention', action: 'build' })
  })

  test('selects the newest live install-ready artifact for each platform', () => {
    const selected = selectInstallableProjectArtifacts(
      [
        artifact({
          id: 'old-apk',
          type: 'apk',
          buildId: 'build-9',
          createdAt: 9,
        }),
        artifact({
          id: 'new-apk',
          type: 'apk',
          buildId: 'build-10',
          createdAt: 10,
        }),
        artifact({
          id: 'expired-ipa',
          type: 'ipa',
          buildId: 'build-11',
          createdAt: 11,
          expiresAt: 99,
        }),
        artifact({
          id: 'older-live-ipa',
          type: 'ipa',
          buildId: 'build-8',
          createdAt: 8,
          expiresAt: 200,
        }),
        artifact({
          id: 'archive',
          type: 'generic',
          buildId: 'build-12',
          createdAt: 12,
        }),
      ],
      100,
    )

    expect(selected.map(({ id }) => id)).toEqual(['new-apk', 'older-live-ipa'])
  })

  test('keeps an older live artifact available after the latest build fails', () => {
    const latestBuild = build(12, 'failed', 12)
    const priorArtifact = artifact({
      id: 'prior-apk',
      type: 'apk',
      buildId: 'build-11',
      createdAt: 11,
      expiresAt: 200,
    })

    expect(
      deriveProjectHealth({
        buildQueryFailed: false,
        hasSourceLink: true,
        latestBuild,
        pipelineCount: 1,
        runnerPaused: false,
        runnerStatusFailed: false,
        sourceAvailable: true,
      }).label,
    ).toBe('Needs attention')
    expect(selectInstallableProjectArtifacts([priorArtifact], 100)).toEqual([
      priorArtifact,
    ])
  })
})
