import {
  Archive02Icon,
  Audit01Icon,
  CpuIcon,
  Delete02Icon,
  Key01Icon,
  Link04Icon,
  Notification03Icon,
  Settings01Icon,
  UserMultiple02Icon,
} from '@hugeicons/core-free-icons'

import type { UserRole } from '@oore/client/models'

const ADMIN_ROLES: ReadonlyArray<UserRole> = ['owner', 'admin']
const OPERATOR_ROLES: ReadonlyArray<UserRole> = ['owner', 'admin', 'developer']

const SETTINGS_GROUPS = [
  {
    title: 'Operations',
    items: [
      {
        title: 'Runners',
        description: 'Runner health, metadata, and Direct runner policy.',
        to: '/settings/runners',
        icon: CpuIcon,
        roles: OPERATOR_ROLES,
      },
      {
        title: 'Sources',
        description: 'Connected repositories and provider credentials.',
        to: '/settings/integrations',
        icon: Link04Icon,
        roles: OPERATOR_ROLES,
      },
    ],
  },
  {
    title: 'Access & security',
    items: [
      {
        title: 'Users',
        description: 'Instance roles and project access.',
        to: '/settings/users',
        icon: UserMultiple02Icon,
        roles: ADMIN_ROLES,
      },
      {
        title: 'API tokens',
        description: 'Personal credentials for automation and tools.',
        to: '/settings/api-tokens',
        icon: Key01Icon,
        roles: OPERATOR_ROLES,
      },
      {
        title: 'Audit log',
        description: 'Security and administrative activity.',
        to: '/settings/audit-log',
        icon: Audit01Icon,
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        title: 'Instance',
        description: 'Runtime, External Access, and service updates.',
        to: '/settings/preferences',
        icon: Settings01Icon,
        roles: ADMIN_ROLES,
      },
      {
        title: 'Artifact storage',
        description: 'Local or S3-compatible artifact persistence.',
        to: '/settings/artifacts',
        icon: Archive02Icon,
        roles: ADMIN_ROLES,
      },
      {
        title: 'Retention',
        description: 'Cleanup policy for builds, logs, and artifacts.',
        to: '/settings/retention',
        icon: Delete02Icon,
        roles: ADMIN_ROLES,
      },
      {
        title: 'Notifications',
        description: 'Build and system notification channels.',
        to: '/settings/notifications',
        icon: Notification03Icon,
        roles: ADMIN_ROLES,
      },
    ],
  },
] as const

export function settingsGroupsForRole(role: UserRole | undefined) {
  if (!role) return []

  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}

export function settingsPaletteItemsForRole(role: UserRole | undefined) {
  return settingsGroupsForRole(role).flatMap((group) =>
    group.items.map((item) => ({
      id: `nav-${item.to.replace('/settings/', '')}`,
      label: item.title,
      icon: item.icon,
      to: item.to,
      keywords:
        item.to === '/settings/preferences'
          ? 'preferences settings config'
          : item.to === '/settings/integrations'
            ? 'integrations github gitlab repositories'
            : item.description,
    })),
  )
}
