import { describe, expect, test } from 'bun:test'

import {
  isSettingsPath,
  isSidebarItemActive,
  sidebarGroupsForRole,
} from './nav-main'

describe('operator sidebar navigation', () => {
  test('shows one settings destination for each operator role', () => {
    for (const role of ['owner', 'admin', 'developer'] as const) {
      const items = sidebarGroupsForRole(role).flatMap((group) => group.items)

      expect(items.map((item) => item.title)).toEqual([
        'Overview',
        'Projects',
        'Builds',
        'Settings',
      ])
      expect(items.filter((item) => item.to.startsWith('/settings'))).toEqual([
        expect.objectContaining({
          title: 'Settings',
          to: '/settings/preferences',
        }),
      ])
    }

    expect(sidebarGroupsForRole('qa_viewer')).toEqual([])
    expect(sidebarGroupsForRole(undefined)).toEqual([])
  })

  test('enters settings mode for the hub and every settings child route', () => {
    expect(isSettingsPath('/settings')).toBe(true)
    expect(isSettingsPath('/settings/')).toBe(true)
    expect(isSettingsPath('/settings/preferences')).toBe(true)
    expect(isSettingsPath('/settings/runners/')).toBe(true)
    expect(isSettingsPath('/settings/integrations/github')).toBe(true)
    expect(isSettingsPath('/projects')).toBe(false)
  })

  test('marks only the current settings destination active', () => {
    expect(
      isSidebarItemActive('/settings/preferences', '/settings/preferences'),
    ).toBe(true)
    expect(
      isSidebarItemActive(
        '/settings/integrations/github',
        '/settings/integrations',
      ),
    ).toBe(true)
    expect(
      isSidebarItemActive('/settings/runners', '/settings/preferences'),
    ).toBe(false)
  })
})
