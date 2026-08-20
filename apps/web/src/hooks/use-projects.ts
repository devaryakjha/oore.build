import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  AddProjectMemberRequest,
  CreateProjectRequest,
  ListProjectsData,
  UpdateProjectMemberRequest,
  UpdateProjectRequest,
} from '@oore/client/models'
import {
  addProjectMemberMutation,
  createProjectMutation,
  deleteProjectMutation,
  getProjectOptions,
  getProjectQueryKey,
  listProjectMemberCandidatesOptions,
  listProjectMemberCandidatesQueryKey,
  listProjectMembersOptions,
  listProjectMembersQueryKey,
  listProjectsInfiniteOptions,
  listProjectsOptions,
  listProjectsQueryKey,
  removeProjectMemberMutation,
  updateProjectMemberMutation,
  updateProjectMutation,
} from '@oore/client/react-query'

import { useApiContext } from '@/hooks/use-api-context'
import {
  createWebOoreClient,
  scopeOoreInfiniteQueryOptions,
  scopeOoreQueryKey,
  scopeOoreQueryOptions,
} from '@/lib/api-client/client'

type ListProjectsParams = NonNullable<ListProjectsData['query']>

function useProjectsApi() {
  const { baseUrl, instance, token } = useApiContext()
  const instanceId = instance?.id ?? '__none__'
  const client = createWebOoreClient({
    baseUrl: baseUrl ?? 'http://127.0.0.1',
    token: token ?? undefined,
  })

  return { baseUrl, client, instanceId, token }
}

export function useInfiniteProjects(
  params?: ListProjectsParams,
  options?: { enabled?: boolean },
) {
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const enabled = options?.enabled ?? true
  const query = scopeOoreInfiniteQueryOptions(
    instanceId,
    listProjectsInfiniteOptions({
      client,
      query: { ...params, limit: params?.limit ?? 100 },
    }),
  )

  return useInfiniteQuery({
    ...query,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (count, page) => count + page.projects.length,
        0,
      )
      return loaded < lastPage.total ? loaded : undefined
    },
    enabled: enabled && !!baseUrl && !!token,
  })
}

export function useProjects(
  params?: ListProjectsParams,
  options?: { enabled?: boolean },
) {
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const enabled = options?.enabled ?? true
  const query = scopeOoreQueryOptions(
    instanceId,
    listProjectsOptions({ client, query: params }),
  )

  return useQuery({
    ...query,
    enabled: enabled && !!baseUrl && !!token,
    placeholderData: keepPreviousData,
  })
}

export function useProject(projectId: string) {
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const query = scopeOoreQueryOptions(
    instanceId,
    getProjectOptions({
      client,
      path: { project_id: projectId },
    }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token && !!projectId,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const mutation = createProjectMutation({ client })
  const mutationKey = scopeOoreQueryKey(instanceId, mutation.mutationKey ?? [])

  return useMutation({
    mutationKey,
    mutationFn: (data: CreateProjectRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return mutation.mutationFn!(
        { body: data, client },
        {
          client: queryClient,
          meta: undefined,
          mutationKey,
        },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectsQueryKey({ client }),
        ),
      })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const mutation = updateProjectMutation({ client })
  const mutationKey = scopeOoreQueryKey(instanceId, mutation.mutationKey ?? [])

  return useMutation({
    mutationKey,
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string
      data: UpdateProjectRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return mutation.mutationFn!(
        {
          body: data,
          client,
          path: { project_id: projectId },
        },
        {
          client: queryClient,
          meta: undefined,
          mutationKey,
        },
      )
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectsQueryKey({ client }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          getProjectQueryKey({
            client,
            path: { project_id: variables.projectId },
          }),
        ),
      })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const mutation = deleteProjectMutation({ client })
  const mutationKey = scopeOoreQueryKey(instanceId, mutation.mutationKey ?? [])

  return useMutation({
    mutationKey,
    mutationFn: (projectId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return mutation.mutationFn!(
        {
          client,
          path: { project_id: projectId },
        },
        {
          client: queryClient,
          meta: undefined,
          mutationKey,
        },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectsQueryKey({ client }),
        ),
      })
    },
  })
}

export function useProjectMembers(projectId: string, enabled = true) {
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const query = scopeOoreQueryOptions(
    instanceId,
    listProjectMembersOptions({
      client,
      path: { project_id: projectId },
    }),
  )

  return useQuery({
    ...query,
    enabled: enabled && !!baseUrl && !!token && !!projectId,
  })
}

export function useProjectMemberCandidates(projectId: string) {
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const query = scopeOoreQueryOptions(
    instanceId,
    listProjectMemberCandidatesOptions({
      client,
      path: { project_id: projectId },
    }),
  )

  return useQuery({
    ...query,
    enabled: !!baseUrl && !!token && !!projectId,
  })
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const mutation = addProjectMemberMutation({ client })
  const mutationKey = scopeOoreQueryKey(instanceId, mutation.mutationKey ?? [])

  return useMutation({
    mutationKey,
    mutationFn: (data: AddProjectMemberRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return mutation.mutationFn!(
        {
          body: data,
          client,
          path: { project_id: projectId },
        },
        {
          client: queryClient,
          meta: undefined,
          mutationKey,
        },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectMembersQueryKey({
            client,
            path: { project_id: projectId },
          }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectMemberCandidatesQueryKey({
            client,
            path: { project_id: projectId },
          }),
        ),
      })
    },
  })
}

export function useUpdateProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const mutation = updateProjectMemberMutation({ client })
  const mutationKey = scopeOoreQueryKey(instanceId, mutation.mutationKey ?? [])

  return useMutation({
    mutationKey,
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string
      data: UpdateProjectMemberRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return mutation.mutationFn!(
        {
          body: data,
          client,
          path: { project_id: projectId, user_id: userId },
        },
        {
          client: queryClient,
          meta: undefined,
          mutationKey,
        },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectMembersQueryKey({
            client,
            path: { project_id: projectId },
          }),
        ),
      })
    },
  })
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, client, instanceId, token } = useProjectsApi()
  const mutation = removeProjectMemberMutation({ client })
  const mutationKey = scopeOoreQueryKey(instanceId, mutation.mutationKey ?? [])

  return useMutation({
    mutationKey,
    mutationFn: (userId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return mutation.mutationFn!(
        {
          client,
          path: { project_id: projectId, user_id: userId },
        },
        {
          client: queryClient,
          meta: undefined,
          mutationKey,
        },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectMembersQueryKey({
            client,
            path: { project_id: projectId },
          }),
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: scopeOoreQueryKey(
          instanceId,
          listProjectMemberCandidatesQueryKey({
            client,
            path: { project_id: projectId },
          }),
        ),
      })
    },
  })
}
