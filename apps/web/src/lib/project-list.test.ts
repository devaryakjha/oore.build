import { describe, expect, test } from 'bun:test'
import type { Build, Pipeline, Project } from '@oore/client/models'

import {
  asProjectListItems,
  latestBuildActivityAt,
  selectProjectLatestBuild,
  type ProjectLatestBuild,
} from './project-list'

function build(overrides: Partial<Build> & Pick<Build, 'id' | 'build_number'>) {
  return {
    id: overrides.id,
    project_id: 'project-1',
    pipeline_id: 'pipeline-1',
    build_number: overrides.build_number,
    status: 'succeeded',
    trigger_type: 'manual',
    config_snapshot: {},
    queued_at: 100,
    created_at: 100,
    updated_at: 120,
    ...overrides,
  } satisfies Build
}

const pipeline = {
  id: 'pipeline-1',
  project_id: 'project-1',
  name: 'iOS release',
  config_path: '.oore/ios.yaml',
  config_path_explicit: true,
  execution_config: {
    platforms: ['ios'],
    flutter_version: 'stable',
    commands: { pre_build: [], build: [], post_build: [] },
    artifact_patterns: [],
  },
  trigger_config: { events: [], branches: [] },
  concurrency: { cancel_previous: false },
  enabled: true,
  created_at: 1,
  updated_at: 1,
} satisfies Pipeline

describe('selectProjectLatestBuild', () => {
  test('selects the greatest build number and includes pipeline context', () => {
    const latest = selectProjectLatestBuild(
      'project-1',
      [
        build({ id: 'newer-time', build_number: 8, updated_at: 500 }),
        build({ id: 'greater-number', build_number: 9, updated_at: 200 }),
        build({
          id: 'other-project',
          project_id: 'project-2',
          build_number: 99,
        }),
      ],
      [pipeline],
    )

    expect(latest).toMatchObject({
      id: 'greater-number',
      build_number: 9,
      pipeline_id: 'pipeline-1',
      pipeline_name: 'iOS release',
    })
  })

  test('keeps a truthful null pipeline name when the pipeline is missing', () => {
    expect(
      selectProjectLatestBuild(
        'project-1',
        [build({ id: 'build-1', build_number: 1 })],
        [],
      )?.pipeline_name,
    ).toBeNull()
  })

  test('returns null when a project has no builds', () => {
    expect(selectProjectLatestBuild('project-1', [], [pipeline])).toBeNull()
  })
})

test('latest build activity prefers terminal time', () => {
  const latest = {
    id: 'build-1',
    build_number: 1,
    status: 'succeeded',
    pipeline_id: 'pipeline-1',
    pipeline_name: 'iOS release',
    created_at: 100,
    updated_at: 180,
    finished_at: 160,
  } satisfies ProjectLatestBuild

  expect(latestBuildActivityAt(latest)).toBe(160)
  expect(latestBuildActivityAt({ ...latest, finished_at: null })).toBe(180)
})

test('compatibility adapter preserves the flattened runtime field', () => {
  const project = {
    id: 'project-1',
    name: 'Mobile app',
    settings: {},
    created_by: 'user-1',
    created_at: 1,
    updated_at: 2,
    current_user_role: 'maintainer',
    latest_build: null,
  } satisfies Project & { latest_build: null }

  const items = asProjectListItems([project])

  expect(items[0]?.latest_build).toBeNull()
})
