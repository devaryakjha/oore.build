import { describe, expect, test } from 'bun:test'

import {
  settingsGroupsForRole,
  settingsPaletteItemsForRole,
} from './settings-navigation'

function destinationTitles(role: Parameters<typeof settingsGroupsForRole>[0]) {
  return settingsGroupsForRole(role).flatMap((group) =>
    group.items.map((item) => item.title),
  )
}

describe('settings navigation', () => {
  test('shows only destinations allowed for each operator role', () => {
    expect(destinationTitles('owner')).toEqual([
      'Runners',
      'Sources',
      'Users',
      'API tokens',
      'Audit log',
      'Instance',
      'Artifact storage',
      'Retention',
      'Notifications',
    ])
    expect(destinationTitles('admin')).toEqual(destinationTitles('owner'))
    expect(destinationTitles('developer')).toEqual([
      'Runners',
      'Sources',
      'API tokens',
    ])
    expect(destinationTitles('qa_viewer')).toEqual([])
    expect(destinationTitles(undefined)).toEqual([])
  })

  test('uses canonical palette labels while retaining old search terms', () => {
    const items = settingsPaletteItemsForRole('owner')
    const general = items.find((item) => item.to === '/settings/preferences')
    const sources = items.find((item) => item.to === '/settings/integrations')

    expect(general?.label).toBe('Instance')
    expect(general?.keywords).toContain('preferences')
    expect(sources?.label).toBe('Sources')
    expect(sources?.keywords).toContain('integrations')
  })
})
