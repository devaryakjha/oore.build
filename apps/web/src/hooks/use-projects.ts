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
  UpdateProjectMemberRequest,
  UpdateProjectRequest,
} from '@/lib/types'
import {
  addProjectMember,
  createProject,
  deleteProject,
  getProject,
  listAllProjects,
  listProjectMemberCandidates,
  listProjectMembers,
  removeProjectMember,
  updateProjectMember,
  updateProject,
} from '@/lib/api'
import { useApiContext } from '@/hooks/use-api-context'
import { listProjects } from '@/api/projects'
import type { ListProjectsParams } from '@/api/types'

interface ProjectHookContext {
  baseUrl: string
  instanceId: string
  token: string
}

interface AllProjectsDependencies {
  context?: ProjectHookContext
  listAllProjects: typeof listAllProjects
}

interface DeleteProjectDependencies {
  context?: ProjectHookContext
  deleteProject: typeof deleteProject
}

const allProjectsDependencies: AllProjectsDependencies = { listAllProjects }
const deleteProjectDependencies: DeleteProjectDependencies = { deleteProject }

export function usePagedProject(
  params?: ListProjectsParams,
  options?: { enabled?: boolean },
) {
  const { baseUrl, instance, token } = useApiContext()
  const enabled = options?.enabled ?? true

  return useInfiniteQuery({
    queryKey: [instance?.id ?? '__none__', 'project-pages', params ?? {}],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listProjects(
        { ...params, limit: params?.limit ?? 20, offset: pageParam },
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

export function useAllProjects(
  params?: {
    search?: string
    sort?: 'created_at' | 'updated_at' | 'name'
    direction?: 'asc' | 'desc'
  },
  options?: { enabled?: boolean },
  dependencies: AllProjectsDependencies = allProjectsDependencies,
) {
  const liveContext = useApiContext()
  const baseUrl = dependencies.context?.baseUrl ?? liveContext.baseUrl
  const token = dependencies.context?.token ?? liveContext.token
  const instanceId =
    dependencies.context?.instanceId ?? liveContext.instance?.id
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: [instanceId ?? '__none__', 'all-projects', params ?? {}],
    queryFn: ({ signal }) =>
      dependencies.listAllProjects(baseUrl!, token!, params, { signal }),
    enabled: enabled && !!baseUrl && !!token,
  })
}

export function useProject(projectId: string) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'project', projectId],
    queryFn: ({ signal }) =>
      getProject(baseUrl!, token!, projectId, { signal }),
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
      return createProject(baseUrl, token, data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'projects'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project-pages'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'all-projects'],
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
      return updateProject(baseUrl, token, projectId, data)
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'projects'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project-pages'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'all-projects'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instance?.id ?? '__none__', 'project', variables.projectId],
      })
    },
  })
}

export function useDeleteProject(
  dependencies: DeleteProjectDependencies = deleteProjectDependencies,
) {
  const queryClient = useQueryClient()
  const liveContext = useApiContext()
  const baseUrl = dependencies.context?.baseUrl ?? liveContext.baseUrl
  const token = dependencies.context?.token ?? liveContext.token
  const instanceId =
    dependencies.context?.instanceId ?? liveContext.instance?.id

  return useMutation({
    mutationFn: (projectId: string) => {
      if (!baseUrl || !token)
        return Promise.reject(new Error('Not authenticated'))
      return dependencies.deleteProject(baseUrl, token, projectId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [instanceId ?? '__none__', 'projects'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instanceId ?? '__none__', 'project-pages'],
      })
      void queryClient.invalidateQueries({
        queryKey: [instanceId ?? '__none__', 'all-projects'],
      })
    },
  })
}

export function useProjectMembers(projectId: string, enabled = true) {
  const { baseUrl, instance, token } = useApiContext()

  return useQuery({
    queryKey: [instance?.id ?? '__none__', 'project-members', projectId],
    queryFn: ({ signal }) =>
      listProjectMembers(baseUrl!, token!, projectId, { signal }),
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
      listProjectMemberCandidates(baseUrl!, token!, projectId, { signal }),
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
      return addProjectMember(baseUrl, token, projectId, data)
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
      return updateProjectMember(baseUrl, token, projectId, userId, data)
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
      return removeProjectMember(baseUrl, token, projectId, userId)
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
