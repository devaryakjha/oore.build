import { describe, expect, it } from 'vitest'

import { getBuildPlatforms } from '@/lib/build-platforms'
import type { Build, JsonObject } from '@/lib/types'

function buildWithSnapshot(configSnapshot: JsonObject): Build {
  return {
    id: 'build-1',
    project_id: 'project-1',
    pipeline_id: 'pipeline-1',
    build_number: 1,
    status: 'queued',
    trigger_type: 'manual',
    config_snapshot: configSnapshot,
    queued_at: 1,
    created_at: 1,
    updated_at: 1,
  }
}

describe('getBuildPlatforms', () => {
  it('prefers a selected platform subset over the configured platforms', () => {
    expect(
      getBuildPlatforms(
        buildWithSnapshot({
          selected_platforms: ['ios'],
          ui_execution_config: { platforms: ['android', 'ios'] },
        }),
      ),
    ).toEqual(['ios'])
  })

  it('reads platforms from the build execution snapshot', () => {
    expect(
      getBuildPlatforms(
        buildWithSnapshot({
          ui_execution_config: {
            platforms: ['android', 'ios', 'android'],
          },
        }),
      ),
    ).toEqual(['android', 'ios'])
  })

  it('supports legacy execution config and top-level snapshots', () => {
    expect(
      getBuildPlatforms(
        buildWithSnapshot({
          execution_config: { platforms: ['macos'] },
        }),
      ),
    ).toEqual(['macos'])
    expect(
      getBuildPlatforms(buildWithSnapshot({ platforms: ['android'] })),
    ).toEqual(['android'])
  })

  it('ignores unsupported or malformed values', () => {
    expect(
      getBuildPlatforms(
        buildWithSnapshot({
          selected_platforms: ['windows'],
          ui_execution_config: { platforms: 'android' },
        }),
      ),
    ).toEqual([])
  })

  it('keeps supported platforms in a mixed platform list', () => {
    expect(
      getBuildPlatforms(
        buildWithSnapshot({
          selected_platforms: ['ios', 'future-platform'],
          ui_execution_config: { platforms: ['android'] },
        }),
      ),
    ).toEqual(['ios'])
  })
})
