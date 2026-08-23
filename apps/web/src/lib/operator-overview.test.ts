import { describe, expect, test } from 'bun:test'
import type { Artifact, Build } from '@oore/client/models'

import {
  groupInstallableBuildArtifacts,
  selectInstallableBuildArtifacts,
  selectOperatorBuildActivity,
} from './operator-overview'

function build(
  id: string,
  status: Build['status'],
  overrides: Partial<Build> = {},
): Build {
  return {
    build_number: Number(id.replace(/\D/g, '')) || 1,
    config_snapshot: {},
    created_at: 100,
    id,
    pipeline_id: 'pipeline-1',
    project_id: 'project-1',
    queued_at: 100,
    status,
    trigger_type: 'manual',
    updated_at: 100,
    ...overrides,
  }
}

function artifact(
  id: string,
  buildId: string,
  type: Artifact['artifact_type'],
  overrides: Partial<Artifact> = {},
): Artifact {
  return {
    artifact_type: type,
    build_id: buildId,
    created_at: 100,
    file_path: `/tmp/${id}`,
    id,
    metadata: {},
    name: `${id}.${type}`,
    state: 'available',
    ...overrides,
  }
}

describe('selectOperatorBuildActivity', () => {
  test('separates blocked work and terminal failures with strict limits', () => {
    const builds = [
      build('blocked-1', 'queued', {
        runner_policy_block_reason: 'repository_unavailable',
        updated_at: 800,
      }),
      build('blocked-2', 'assigned', {
        runner_policy_block_reason: 'instance_paused',
        updated_at: 700,
      }),
      build('blocked-3', 'scheduled', {
        runner_policy_block_reason: 'repository_unavailable',
        updated_at: 600,
      }),
      build('blocked-4', 'running', {
        runner_policy_block_reason: 'instance_paused',
        updated_at: 500,
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        build(`failed-${index}`, index % 2 ? 'timed_out' : 'failed', {
          updated_at: 400 - index,
        }),
      ),
      build('success-1', 'succeeded', { updated_at: 900 }),
    ]

    const selected = selectOperatorBuildActivity(builds)

    expect(selected.blocked.map(({ id }) => id)).toEqual([
      'blocked-1',
      'blocked-2',
      'blocked-3',
    ])
    expect(selected.failures).toHaveLength(4)
    expect(selected.succeeded.map(({ id }) => id)).toEqual(['success-1'])
  })
})

describe('selectInstallableBuildArtifacts', () => {
  test('keeps the newest ready artifact per project and platform', () => {
    const builds = [
      build('build-new', 'succeeded', {
        project_id: 'project-1',
        created_at: 300,
      }),
      build('build-old', 'succeeded', {
        project_id: 'project-1',
        created_at: 200,
      }),
      build('build-other', 'succeeded', {
        project_id: 'project-2',
        created_at: 100,
      }),
    ]
    const artifacts = [
      artifact('new-apk', 'build-new', 'apk'),
      artifact('old-apk', 'build-old', 'apk'),
      artifact('other-apk', 'build-other', 'apk'),
      artifact('generic', 'build-new', 'generic'),
      artifact('uploading', 'build-new', 'apk', { state: 'uploading' }),
      artifact('expired', 'build-new', 'apk', { expires_at: 900 }),
    ]

    const selected = selectInstallableBuildArtifacts({
      artifacts,
      builds,
      now: 1_000,
    })

    expect(selected.map(({ artifact: value }) => value.id)).toEqual([
      'new-apk',
      'other-apk',
    ])
  })

  test('groups Android and iOS artifacts from the same build', () => {
    const sharedBuild = build('multi-platform', 'succeeded')
    const grouped = groupInstallableBuildArtifacts([
      {
        artifact: artifact('android', sharedBuild.id, 'apk'),
        build: sharedBuild,
      },
      {
        artifact: artifact('ios', sharedBuild.id, 'ipa'),
        build: sharedBuild,
      },
      {
        artifact: artifact('other', 'other-build', 'apk'),
        build: build('other-build', 'succeeded'),
      },
    ])

    expect(
      grouped.map(({ artifacts: values, build: value }) => ({
        artifacts: values.map(({ id }) => id),
        build: value.id,
      })),
    ).toEqual([
      { artifacts: ['android', 'ios'], build: 'multi-platform' },
      { artifacts: ['other'], build: 'other-build' },
    ])
  })

  test('rejects unsigned IPA artifacts and artifacts from failed builds', () => {
    const selected = selectInstallableBuildArtifacts({
      artifacts: [
        artifact('unsigned-ipa', 'success', 'ipa'),
        artifact('failed-apk', 'failed', 'apk'),
      ],
      builds: [build('success', 'succeeded'), build('failed', 'failed')],
      now: 1_000,
    })

    expect(selected).toEqual([])
  })
})
