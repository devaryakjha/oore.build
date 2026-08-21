import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  deleteUser,
  inviteUser,
  logout,
  reEnableUser,
  updateUserRole,
} from '@oore/client/operations'
import { listUsersOptions, listUsersQueryKey } from '@oore/client/react-query'
import type {
  InviteUserRequest,
  ListUsersData,
  UpdateUserRoleRequest,
} from '@oore/client/models'
import { useAuthStore } from '@/stores/auth-store'
import { useApiContext } from '@/hooks/use-api-context'
import {
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

type ListUsersParams = NonNullable<ListUsersData['query']>

export function useUsers(params?: ListUsersParams) {
  const { baseUrl, client, instanceId, token } = useApiContext()
  const query = scopeOoreQueryOptions(
    instanceId,
    listUsersOptions({ client, query: params }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token,
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (data: InviteUserRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return inviteUser({ body: data, client })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(instanceId, listUsersQueryKey({ client })),
      })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string
      data: UpdateUserRoleRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updateUserRole({ body: data, client, path: { user_id: userId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(instanceId, listUsersQueryKey({ client })),
      })
    },
  })
}

export function useReEnableUser() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return reEnableUser({ client, path: { user_id: userId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(instanceId, listUsersQueryKey({ client })),
      })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useApiContext()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return deleteUser({ client, path: { user_id: userId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(instanceId, listUsersQueryKey({ client })),
      })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { baseUrl, client, token } = useApiContext()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: () => {
      if (!baseUrl || !token) return Promise.resolve({ ok: true })
      return logout({ client })
    },
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      void router.navigate({ to: '/login', replace: true })
    },
  })
}
