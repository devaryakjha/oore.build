import { createFileRoute } from '@tanstack/react-router'

import {
  getActiveInstanceOrRedirect,
  requireInstanceRoleOrRedirect,
} from '@/lib/instance-context'

export type {
  ExternalAccessNetworkFormValues,
  ExternalAccessOidcFormValues,
  TrustedProxyFormValues,
} from './preferences.lazy'

export const Route = createFileRoute('/settings/preferences')({
  staticData: {
    breadcrumb: {
      title: 'Instance',
    },
  },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireInstanceRoleOrRedirect(instance.id, ['owner', 'admin'])
  },
})
