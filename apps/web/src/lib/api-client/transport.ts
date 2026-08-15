import * as z from 'zod/mini'

import { READ_ONLY_REASON, isDemoMutationBlocked } from '@/lib/demo-mode'
import type { ApiError } from './generated/models'

const apiErrorSchema = z.object({
  code: z.string(),
  details: z.nullish(z.string()),
  error: z.string(),
})

export interface OoreRequestOptions extends RequestInit {
  readonly baseUrl?: string
  readonly token?: string
}

export class ApiClientError extends Error {
  readonly code: string
  readonly details: string | null | undefined
  readonly status: number

  constructor(status: number, body: ApiError) {
    super(body.error)
    this.name = 'ApiClientError'
    this.code = body.code
    this.details = body.details
    this.status = status
  }
}

async function readApiError(response: Response): Promise<ApiError> {
  try {
    const text = await response.text()
    const body = JSON.parse(text)
    return apiErrorSchema.parse(body)
  } catch {
    return {
      code: 'unknown_error',
      error: `Request failed with status ${response.status}`,
    }
  }
}

export async function ooreRequest<T>(
  path: string,
  {
    baseUrl,
    token,
    headers: requestHeaders,
    ...requestOptions
  }: OoreRequestOptions = {},
): Promise<T> {
  const method = (requestOptions.method ?? 'GET').toUpperCase()
  const requestUrl = new URL(path, baseUrl)
  const requestPath = new URL(requestUrl, 'http://localhost').pathname
  if (isDemoMutationBlocked(method, requestPath)) {
    throw new ApiClientError(403, {
      code: 'demo_read_only',
      error: READ_ONLY_REASON,
    })
  }

  const headers = new Headers(requestHeaders)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(requestUrl, {
    ...requestOptions,
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    throw new ApiClientError(response.status, await readApiError(response))
  }

  if ([204, 205, 304].includes(response.status)) {
    // SAFETY: OpenAPI operations with an empty response generate `void` as T.
    return undefined as T
  }

  const body = await response.text()
  if (!body) {
    // SAFETY: An empty successful response has no value to return.
    return undefined as T
  }

  const data: unknown = JSON.parse(body)
  // SAFETY: Orval fixes T from the response schema for this operation.
  return data as T
}
