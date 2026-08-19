import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useApiContext } from '@/hooks/use-api-context'
import {
  listProjects,
  deleteProject,
  getProject,
  createProject,
  updateProject,
} from '@/api/projects'
import {
  addProjectMember,
  listProjectMemberCandidates,
  listProjectMembers,
  removeProjectMember,
  updateProjectMember,
} from '@/api/project-members'
import type {
  AddProjectMemberRequest,
  CreateProjectRequest,
  ListProjectsParams,
  UpdateProjectMemberRequest,
  UpdateProjectRequest,
} from '@/api/types'

export function useInfiniteProjects(
  params?: ListProjectsParams,
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()
  const enabled = options?.enabled ?? true

  return useInfiniteQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'projects',
      'infinite',
      params ?? {},
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listProjects(
        { ...params, limit: params?.limit ?? 100, offset: pageParam },
        { signal, baseUrl: baseUrl!, token: token! },
      ),
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
  const { baseUrl, instance, token } = useApiContext()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'projects', params ?? {}],
    queryFn: ({ signal }) =>
      listProjects(params, { signal, baseUrl: baseUrl!, token: token! }),
    enabled: enabled && !!baseUrl && !!token,
    placeholderData: keepPreviousData,
  })
}

export function useProject(projectId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'project', projectId],
    queryFn: ({ signal }) =>
      getProject(projectId, { signal, baseUrl: baseUrl!, token: token! }),
    enabled: !!baseUrl && !!token && !!projectId,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return createProject(data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'projects'],
      })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string
      data: UpdateProjectRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updateProject(projectId, data, { baseUrl, token })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'projects'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project', variables.projectId],
      })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (projectId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return deleteProject(projectId, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'projects'],
      })
    },
  })
}

export function useProjectMembers(projectId: string, enabled = true) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'project-members', projectId],
    queryFn: ({ signal }) =>
      listProjectMembers(projectId, {
        signal,
        baseUrl: baseUrl!,
        token: token!,
      }),
    enabled: enabled && !!baseUrl && !!token && !!projectId,
  })
}

export function useProjectMemberCandidates(projectId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [
      instance?.id ?? '__none__',
      'project-member-candidates',
      projectId,
    ],
    queryFn: ({ signal }) =>
      listProjectMemberCandidates(projectId, {
        signal,
        baseUrl: baseUrl!,
        token: token!,
      }),
    enabled: !!baseUrl && !!token && !!projectId,
  })
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (data: AddProjectMemberRequest) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return addProjectMember(projectId, data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project-members', projectId],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'project-member-candidates',
          projectId,
        ],
      })
    },
  })
}

export function useUpdateProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string
      data: UpdateProjectMemberRequest
    }) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return updateProjectMember(projectId, userId, data, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project-members', projectId],
      })
    },
  })
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  const { baseUrl, instance, token } = useApiContext()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return removeProjectMember(projectId, userId, { baseUrl, token })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project-members', projectId],
      })
      void queryClient.invalidateQueries({
        queryKey: [
          instance?.id ?? '__none__',
          'project-member-candidates',
          projectId,
        ],
      })
    },
  })
}
