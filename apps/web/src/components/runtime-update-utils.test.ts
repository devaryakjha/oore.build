import { describe, expect, it } from 'vitest'
import { formatReleaseNotes } from './runtime-update-utils'

describe('formatReleaseNotes', () => {
  it('removes generated release wrappers while preserving the changelog body', () => {
    expect(
      formatReleaseNotes(`# v1.2.3

Changes since v1.2.2:

- fix(web): show updates everywhere

**Full Changelog**: https://github.com/example/oore/compare/v1.2.2...v1.2.3`),
    ).toBe('Changes since v1.2.2:\n\n- fix(web): show updates everywhere')
  })
})
