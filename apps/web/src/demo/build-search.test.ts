import { describe, expect, test } from 'bun:test'

import { matchesDemoBuildSearch } from './build-search'

const build = {
  buildNumber: 42,
  projectName: 'Alpha Workspace',
  pipelineName: 'Beta Release',
  branch: 'feature/MixedCase',
  commitSha: 'abcDEF123456',
}

describe('demo build search', () => {
  test.each([
    ['project name', 'ALPHA workspace'],
    ['pipeline name', 'beta RELEASE'],
    ['branch', 'FEATURE/mixedcase'],
    ['commit SHA', 'def123'],
  ])('matches a case-insensitive %s substring', (_field, search) => {
    expect(matchesDemoBuildSearch(build, search)).toBe(true)
  })

  test('matches an exact build number with or without a hash', () => {
    expect(matchesDemoBuildSearch(build, '42')).toBe(true)
    expect(matchesDemoBuildSearch(build, '#42')).toBe(true)
    expect(matchesDemoBuildSearch(build, '  #42  ')).toBe(true)
    expect(matchesDemoBuildSearch(build, '#4')).toBe(false)
    expect(matchesDemoBuildSearch(build, '420')).toBe(false)
    expect(matchesDemoBuildSearch(build, '+42')).toBe(false)
  })

  test('treats wildcard characters as literal text', () => {
    expect(
      matchesDemoBuildSearch({ ...build, branch: 'release%candidate' }, '%'),
    ).toBe(true)
    expect(
      matchesDemoBuildSearch({ ...build, projectName: 'under_score' }, '_'),
    ).toBe(true)
    expect(matchesDemoBuildSearch(build, '%')).toBe(false)
    expect(matchesDemoBuildSearch(build, '_')).toBe(false)
  })

  test('ignores empty input and rejects unrelated values', () => {
    expect(matchesDemoBuildSearch(build, '   ')).toBe(true)
    expect(matchesDemoBuildSearch(build, 'does-not-exist')).toBe(false)
  })
})
