import { describe, expect, it } from 'vitest'

import { isSidebarItemActive, sidebarGroupsForRole } from './nav-main'

function navigationFor(role: 'owner' | 'admin' | 'developer' | 'qa_viewer') {
  return sidebarGroupsForRole(role).flatMap((group) =>
    group.items.map((item) => item.to),
  )
}

describe('sidebar navigation', () => {
  it('gives instance administrators every operator destination', () => {
    const expected = [
      '/',
      '/projects',
      '/builds',
      '/settings/preferences',
      '/settings/runners',
      '/settings/integrations',
      '/settings/artifacts',
      '/settings/retention',
      '/settings/users',
      '/settings/api-tokens',
      '/settings/notifications',
      '/settings/audit-log',
    ]

    expect(navigationFor('owner')).toEqual(expected)
    expect(navigationFor('admin')).toEqual(expected)
  })

  it('shows developers only routes allowed by the settings guards', () => {
    expect(navigationFor('developer')).toEqual([
      '/',
      '/projects',
      '/builds',
      '/settings/runners',
      '/settings/integrations',
      '/settings/api-tokens',
    ])
  })

  it('keeps the QA release workspace outside the operator sidebar', () => {
    expect(navigationFor('qa_viewer')).toEqual([])
  })

  it('activates owning entries without competing with the retained settings hub', () => {
    expect(isSidebarItemActive('/', '/')).toBe(true)
    expect(isSidebarItemActive('/projects/project-1', '/projects')).toBe(true)
    expect(isSidebarItemActive('/builds/build-1', '/builds')).toBe(true)
    expect(isSidebarItemActive('/settings', '/settings/preferences')).toBe(
      false,
    )
    expect(isSidebarItemActive('/settings', '/settings/runners')).toBe(false)
    expect(isSidebarItemActive('/settings', '/settings/integrations')).toBe(
      false,
    )
    expect(
      isSidebarItemActive(
        '/settings/integrations/integration-1',
        '/settings/integrations',
      ),
    ).toBe(true)
    expect(
      isSidebarItemActive(
        '/settings/notifications/channel-1',
        '/settings/notifications',
      ),
    ).toBe(true)
    expect(isSidebarItemActive('/projects-old', '/projects')).toBe(false)
  })
})
