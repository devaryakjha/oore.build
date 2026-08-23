import { describe, expect, test } from 'bun:test'

import { isSidebarItemActive, sidebarGroupsForRole } from './nav-main'

describe('operator sidebar navigation', () => {
  test('groups operator destinations by purpose and role', () => {
    expect(
      sidebarGroupsForRole('owner').map((group) => ({
        title: group.title,
        items: group.items.map((item) => item.title),
      })),
    ).toEqual([
      { title: 'Workspace', items: ['Overview', 'Projects', 'Builds'] },
      { title: 'Operations', items: ['Runners', 'Sources'] },
      {
        title: 'Access & security',
        items: ['Users', 'API tokens', 'Audit log'],
      },
      {
        title: 'Settings',
        items: ['Instance', 'Artifact storage', 'Retention', 'Notifications'],
      },
    ])
    expect(
      sidebarGroupsForRole('developer').map((group) => ({
        title: group.title,
        items: group.items.map((item) => item.title),
      })),
    ).toEqual([
      { title: 'Workspace', items: ['Overview', 'Projects', 'Builds'] },
      { title: 'Operations', items: ['Runners', 'Sources'] },
      { title: 'Access & security', items: ['API tokens'] },
    ])

    expect(sidebarGroupsForRole('qa_viewer')).toEqual([])
    expect(sidebarGroupsForRole(undefined)).toEqual([])
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
