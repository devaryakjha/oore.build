import { describe, expect, test } from 'bun:test'

import { isSidebarItemActive, sidebarGroupsForRole } from './nav-main'

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
        expect.objectContaining({ title: 'Settings', to: '/settings' }),
      ])
    }

    expect(sidebarGroupsForRole('qa_viewer')).toEqual([])
    expect(sidebarGroupsForRole(undefined)).toEqual([])
  })

  test('keeps settings active for every child route', () => {
    expect(isSidebarItemActive('/settings', '/settings')).toBe(true)
    expect(isSidebarItemActive('/settings/preferences', '/settings')).toBe(true)
    expect(isSidebarItemActive('/settings/runners/', '/settings')).toBe(true)
    expect(
      isSidebarItemActive('/settings/integrations/github', '/settings'),
    ).toBe(true)
    expect(isSidebarItemActive('/projects', '/settings')).toBe(false)
  })
})
