import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  deleteUser,
  inviteUser,
  listUsers,
  reEnableUser,
  updateUserRole,
} from '@/api/users'
import { logout } from '@/api/auth'
import type {
  InviteUserRequest,
  ListUsersParams,
  UpdateUserRoleRequest,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth-store'
import { useApiContext } from '@/hooks/use-api-context'

export function useUsers(params?: ListUsersParams) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'users', params ?? {}],
    queryFn: ({ signal }) =>
      listUsers(params, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token,
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: InviteUserRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return inviteUser(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'users'],
      })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

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
      return updateUserRole(userId, data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'users'],
      })
    },
  })
}

export function useReEnableUser() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return reEnableUser(userId, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'users'],
      })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return deleteUser(userId, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'users'],
      })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { baseUrl, token } = useApiContext()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: () => {
      if (!baseUrl || !token) return Promise.resolve({ ok: true })
      return logout({ baseUrl, token })
    },
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      void router.navigate({ to: '/login', replace: true })
    },
  })
}
