import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
} from '@/lib/types'
import {
  createNotificationChannel,
  deleteNotificationChannel,
  getNotificationChannel,
  listNotificationChannels,
  listNotificationDeliveries,
  testNotificationChannel,
  updateNotificationChannel,
} from '@/lib/api'
import { useApiContext } from '@/hooks/use-api-context'
import type { CollectionParams } from '@/lib/api'

export function useNotificationChannels(params?: CollectionParams) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'notification-channels',
      params ?? {},
    ],
    queryFn: ({ signal }) =>
      listNotificationChannels(baseUrl!, token!, params, { signal }),
    enabled: !!baseUrl && !!token,
  })
}

export function useNotificationChannel(channelId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'notification-channel', channelId],
    queryFn: ({ signal }) =>
      getNotificationChannel(baseUrl!, token!, channelId, { signal }),
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
      return createNotificationChannel(baseUrl, token, data)
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
      return updateNotificationChannel(baseUrl, token, id, data)
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
      return deleteNotificationChannel(baseUrl, token, id)
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
      return testNotificationChannel(baseUrl, token, id)
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
      listNotificationDeliveries(baseUrl!, token!, channelId, { signal }),
    enabled: !!baseUrl && !!token && !!channelId,
  })
}
