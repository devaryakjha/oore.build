import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createNotificationChannel,
  deleteNotificationChannel,
  getNotificationChannel,
  listNotificationChannels,
  listNotificationDeliveries,
  testNotificationChannel,
  updateNotificationChannel,
} from '@/api/notification-channels'
import type {
  CreateNotificationChannelRequest,
  ListNotificationChannelsParams,
  UpdateNotificationChannelRequest,
} from '@/api/types'
import { useApiContext } from '@/hooks/use-api-context'

export function useNotificationChannels(
  params?: ListNotificationChannelsParams,
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'notification-channels',
      params ?? {},
    ],
    queryFn: ({ signal }) =>
      listNotificationChannels(params, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token,
  })
}

export function useNotificationChannel(channelId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'notification-channel', channelId],
    queryFn: ({ signal }) =>
      getNotificationChannel(channelId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token && !!channelId,
  })
}

export function useCreateNotificationChannel() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: CreateNotificationChannelRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return createNotificationChannel(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'notification-channels'],
      })
    },
  })
}

export function useUpdateNotificationChannel() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateNotificationChannelRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updateNotificationChannel(id, data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'notification-channels'],
      })
    },
  })
}

export function useDeleteNotificationChannel() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (id: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return deleteNotificationChannel(id, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'notification-channels'],
      })
    },
  })
}

export function useTestNotificationChannel() {
  const { baseUrl, token } = useApiContext()

  return useMutation({
    mutationFn: (id: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return testNotificationChannel(id, { baseUrl, token })
    },
  })
}

export function useNotificationDeliveries(channelId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'notification-deliveries',
      channelId,
    ],
    queryFn: ({ signal }) =>
      listNotificationDeliveries(channelId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: !!baseUrl && !!token && !!channelId,
  })
}
