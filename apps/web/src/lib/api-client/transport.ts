import { READ_ONLY_REASON, isDemoMutationBlocked } from '@/lib/demo-mode'
import { ApiClientError, readApiError } from './api-error'

export { ApiClientError } from './api-error'

export interface OoreRequestOptions extends RequestInit {
  readonly baseUrl?: string
  readonly token?: string
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
  if (!headers.has('Authorization') && token) {
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
