import useSWR, { mutate } from 'swr'
import { apiFetch, fetcher } from './client'
import type { PipelineConfig, CreatePipelineConfigRequest, ValidatePipelineResponse } from './types'

export function usePipelineConfig(repositoryId: string | null) {
  return useSWR<PipelineConfig>(
    repositoryId ? `/api/repositories/${repositoryId}/pipeline` : null,
    fetcher,
    {
      // Don't throw on 404 - it just means no config exists
      shouldRetryOnError: (error) => error?.status !== 404,
    }
  )
}

export async function savePipelineConfig(
  repositoryId: string,
  data: CreatePipelineConfigRequest
): Promise<PipelineConfig> {
  const result = await apiFetch<PipelineConfig>(`/api/repositories/${repositoryId}/pipeline`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  await mutate(`/api/repositories/${repositoryId}/pipeline`)
  return result
}

export async function deletePipelineConfig(repositoryId: string): Promise<void> {
  await apiFetch(`/api/repositories/${repositoryId}/pipeline`, {
    method: 'DELETE',
  })
  await mutate(`/api/repositories/${repositoryId}/pipeline`)
}

export async function validatePipelineConfig(
  data: CreatePipelineConfigRequest
): Promise<ValidatePipelineResponse> {
  return apiFetch<ValidatePipelineResponse>('/api/pipelines/validate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
