import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/lib/constants'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function hasAuthToken(): boolean {
  return !!getAuthToken()
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options
  const token = getAuthToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  if (!skipAuth && token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${endpoint}`

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  if (!res.ok) {
    let errorMessage = 'Request failed'
    let errorCode: string | undefined

    try {
      const errorData = await res.json()
      if (errorData.error) {
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error
        } else if (errorData.error.message) {
          errorMessage = errorData.error.message
          errorCode = errorData.error.code
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }

    throw new ApiError(res.status, errorMessage, errorCode)
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

// SWR fetcher
export const fetcher = <T>(url: string): Promise<T> => apiFetch<T>(url)
