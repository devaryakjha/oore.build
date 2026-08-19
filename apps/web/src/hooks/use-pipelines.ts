import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  CreatePipelineRequest,
  RegisterIosDeviceRequest,
  UpdatePipelineAndroidSigningRequest,
  UpdatePipelineIosSigningRequest,
  UpdatePipelineRequest,
  ValidatePipelineRequest,
} from '@/api/types'
import {
  createPipeline,
  deletePipeline,
  discoverRepositoryWorkflows,
  getPipeline,
  listPipelines,
  updatePipeline,
  validatePipeline,
} from '@/api/pipelines'
import {
  getPipelineAndroidSigning,
  getPipelineIosSigning,
  listPipelineIosDevices,
  registerPipelineIosDevice,
  syncPipelineIosSigning,
  updatePipelineAndroidSigning,
  updatePipelineIosSigning,
} from '@/api/pipeline-signing'
import { useApiContext } from '@/hooks/use-api-context'

export function usePipelines(
  projectId: string,
  params?: {
    search?: string
    sort?: 'created_at' | 'name'
    direction?: 'asc' | 'desc'
    limit?: number
    offset?: number
  },
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'pipelines',
      projectId,
      params ?? {},
    ],
    queryFn: ({ signal }) =>
      listPipelines(projectId, params, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: enabled && !!baseUrl && !!token && !!projectId,
  })
}

export function useInfinitePipelines(
  projectId: string,
  params?: {
    search?: string
    sort?: 'created_at' | 'name'
    direction?: 'asc' | 'desc'
    limit?: number
  },
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()
  const enabled = options?.enabled ?? true

  return useInfiniteQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'pipelines',
      projectId,
      'infinite',
      params ?? {},
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listPipelines(
        projectId,
        { ...params, limit: params?.limit ?? 100, offset: pageParam },
        { baseUrl: baseUrl!, token: token!, signal },
      ),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (count, page) => count + page.pipelines.length,
        0,
      )
      return loaded < lastPage.total ? loaded : undefined
    },
    enabled: enabled && !!baseUrl && !!token && !!projectId,
  })
}

export function useRepositoryWorkflows(
  projectId: string,
  params?: { reference?: string; path?: string },
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'repository-workflows',
      projectId,
      params ?? {},
    ],
    queryFn: ({ signal }) =>
      discoverRepositoryWorkflows(projectId, params, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: enabled && !!baseUrl && !!token && !!projectId,
    staleTime: 30_000,
  })
}

export function usePipeline(pipelineId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'pipeline', pipelineId],
    queryFn: ({ signal }) =>
      getPipeline(pipelineId, { baseUrl: baseUrl!, token: token!, signal }),
    enabled: !!baseUrl && !!token && !!pipelineId,
  })
}

export function useCreatePipeline() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string
      data: CreatePipelineRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return createPipeline(projectId, data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'pipelines'],
      })
    },
  })
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      pipelineId,
      data,
    }: {
      pipelineId: string
      data: UpdatePipelineRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updatePipeline(pipelineId, data, { baseUrl, token })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'pipelines'],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline',
          variables.pipelineId,
        ],
      })
    },
  })
}

export function useDeletePipeline() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (pipelineId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return deletePipeline(pipelineId, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'pipelines'],
      })
    },
  })
}

export function useValidatePipeline() {
  const { baseUrl, token } = useApiContext()

  return useMutation({
    mutationFn: (data: ValidatePipelineRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return validatePipeline(data, { baseUrl, token })
    },
  })
}

export function usePipelineAndroidSigning(
  pipelineId: string,
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'pipeline-android-signing',
      pipelineId,
    ],
    queryFn: ({ signal }) =>
      getPipelineAndroidSigning(pipelineId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token && !!pipelineId,
  })
}

export function useUpdatePipelineAndroidSigning() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      pipelineId,
      data,
    }: {
      pipelineId: string
      data: UpdatePipelineAndroidSigningRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updatePipelineAndroidSigning(pipelineId, data, { baseUrl, token })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-android-signing',
          variables.pipelineId,
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline',
          variables.pipelineId,
        ],
      })
    },
  })
}

export function usePipelineIosSigning(
  pipelineId: string,
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'pipeline-ios-signing', pipelineId],
    queryFn: ({ signal }) =>
      getPipelineIosSigning(pipelineId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token && !!pipelineId,
  })
}

export function useUpdatePipelineIosSigning() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      pipelineId,
      data,
    }: {
      pipelineId: string
      data: UpdatePipelineIosSigningRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updatePipelineIosSigning(pipelineId, data, { baseUrl, token })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-ios-signing',
          variables.pipelineId,
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-ios-signing-devices',
          variables.pipelineId,
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline',
          variables.pipelineId,
        ],
      })
    },
  })
}

export function usePipelineIosDevices(
  pipelineId: string,
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'pipeline-ios-signing-devices',
      pipelineId,
    ],
    queryFn: ({ signal }) =>
      listPipelineIosDevices(pipelineId, {
        baseUrl: baseUrl!,
        token: token!,
        signal,
      }),
    enabled: (options?.enabled ?? true) && !!baseUrl && !!token && !!pipelineId,
  })
}

export function useRegisterPipelineIosDevice() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      pipelineId,
      data,
    }: {
      pipelineId: string
      data: RegisterIosDeviceRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return registerPipelineIosDevice(pipelineId, data, { baseUrl, token })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-ios-signing-devices',
          variables.pipelineId,
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-ios-signing',
          variables.pipelineId,
        ],
      })
    },
  })
}

export function useSyncPipelineIosSigning() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (pipelineId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return syncPipelineIosSigning(pipelineId, { baseUrl, token })
    },
    onSuccess: (_data, pipelineId) => {
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-ios-signing',
          pipelineId,
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'pipeline-ios-signing-devices',
          pipelineId,
        ],
      })
    },
  })
}
