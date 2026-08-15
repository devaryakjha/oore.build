import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAllPipelines, useDeletePipeline } from './use-pipelines'
import { useAllProjects, useDeleteProject } from './use-projects'

const mocks = {
  deletePipeline: vi.fn(),
  deleteProject: vi.fn(),
  listAllPipelines: vi.fn(),
  listAllProjects: vi.fn(),
}

const context = {
  baseUrl: 'https://ci.example.com',
  instanceId: 'instance-1',
  token: 'session-token',
}

function queryWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('aggregate query invalidation', () => {
  beforeEach(() => {
    mocks.deletePipeline.mockReset()
    mocks.deleteProject.mockReset()
    mocks.listAllPipelines.mockReset()
    mocks.listAllProjects.mockReset()
  })

  it('removes a deleted project from an active all-projects selector', async () => {
    let projects = [{ id: 'project-1', current_user_role: 'maintainer' }]
    mocks.listAllProjects.mockImplementation(() =>
      Promise.resolve({ projects, total: projects.length }),
    )
    mocks.deleteProject.mockImplementation(() => {
      projects = []
      return Promise.resolve()
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(
      () => ({
        projects: useAllProjects(undefined, undefined, {
          context,
          listAllProjects: mocks.listAllProjects,
        }),
        removeProject: useDeleteProject({
          context,
          deleteProject: mocks.deleteProject,
        }),
      }),
      { wrapper: queryWrapper(client) },
    )

    await waitFor(() =>
      expect(result.current.projects.data?.projects).toHaveLength(1),
    )
    await act(async () => {
      await result.current.removeProject.mutateAsync('project-1')
    })

    await waitFor(() =>
      expect(result.current.projects.data?.projects).toHaveLength(0),
    )
    expect(mocks.listAllProjects).toHaveBeenCalledTimes(2)
  })

  it('removes a deleted pipeline from an active all-pipelines selector', async () => {
    let pipelines = [{ id: 'pipeline-1' }]
    mocks.listAllPipelines.mockImplementation(() =>
      Promise.resolve({ pipelines, total: pipelines.length }),
    )
    mocks.deletePipeline.mockImplementation(() => {
      pipelines = []
      return Promise.resolve()
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(
      () => ({
        pipelines: useAllPipelines('project-1', undefined, undefined, {
          context,
          listAllPipelines: mocks.listAllPipelines,
        }),
        removePipeline: useDeletePipeline({
          context,
          deletePipeline: mocks.deletePipeline,
        }),
      }),
      { wrapper: queryWrapper(client) },
    )

    await waitFor(() =>
      expect(result.current.pipelines.data?.pipelines).toHaveLength(1),
    )
    await act(async () => {
      await result.current.removePipeline.mutateAsync('pipeline-1')
    })

    await waitFor(() =>
      expect(result.current.pipelines.data?.pipelines).toHaveLength(0),
    )
    expect(mocks.listAllPipelines).toHaveBeenCalledTimes(2)
  })
})
