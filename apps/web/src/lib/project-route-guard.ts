import { redirect } from '@tanstack/react-router'
import { getProjectOptions } from '@oore/client/react-query'
import type { ProjectDetailResponse } from '@oore/client/models'

import { hasProjectPermission } from '@/hooks/use-permissions'
import {
  createWebOoreClient,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'
import { queryClient } from '@/lib/query-client'
import { resolveRequiredInstanceApiBaseUrl } from '@/lib/instance-url'
import type { Instance } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'

export async function requireProjectPermissionOrRedirect({
  action,
  instance,
  projectId,
  resource,
  token,
}: {
  action: string
  instance: Instance
  projectId: string
  resource: string
  token: string
}): Promise<ProjectDetailResponse> {
  const client = createWebOoreClient({
    baseUrl: resolveRequiredInstanceApiBaseUrl(instance),
    token,
  })
  const projectOptions = scopeOoreQueryOptions(
    instance.id,
    getProjectOptions({
      client,
      path: { project_id: projectId },
    }),
  )
  const instanceRole = useAuthStore.getState().user?.role
  if (instanceRole === 'owner' || instanceRole === 'admin') {
    return queryClient.ensureQueryData(projectOptions)
  }

  if (instanceRole !== 'developer') throw redirect({ to: '/' })

  const project = await queryClient.ensureQueryData(projectOptions)
  const projectRole = project.project.current_user_role
  if (!hasProjectPermission(projectRole, `${resource}:${action}`)) {
    throw redirect({
      to: '/projects/$projectId',
      params: { projectId },
    })
  }
  return project
}
