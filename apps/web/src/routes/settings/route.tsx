import {
  getActiveInstanceOrRedirect,
  requireInstanceRoleOrRedirect,
} from '@/lib/instance-context'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  beforeLoad: ({ location }) => {
    const instance = getActiveInstanceOrRedirect()
    requireInstanceRoleOrRedirect(instance.id, ['owner', 'admin', 'developer'])

    if (location.pathname.replace(/\/+$/, '') === '/settings') {
      throw redirect({ to: '/settings/preferences' })
    }
  },
})
