import { describe, expect, it } from 'vitest'

import { canAccessSettings, settingsGroupsForRole } from './settings-navigation'

function destinationsFor(role: 'owner' | 'admin' | 'developer' | 'qa_viewer') {
  return settingsGroupsForRole(role).flatMap((group) =>
    group.items.map((item) => item.to),
  )
}

describe('settings navigation', () => {
  it('keeps the full grouped hub available to instance administrators', () => {
    expect(destinationsFor('owner')).toEqual([
      '/settings/preferences',
      '/settings/runners',
      '/settings/integrations',
      '/settings/artifacts',
      '/settings/retention',
      '/settings/users',
      '/settings/api-tokens',
      '/settings/notifications',
      '/settings/audit-log',
    ])
  })

  it('limits developers to their supported read and token surfaces', () => {
    expect(destinationsFor('developer')).toEqual([
      '/settings/runners',
      '/settings/integrations',
      '/settings/api-tokens',
    ])
  })

  it('keeps the tester workspace out of instance settings', () => {
    expect(canAccessSettings('qa_viewer')).toBe(false)
    expect(settingsGroupsForRole('qa_viewer')).toEqual([])
  })
})
