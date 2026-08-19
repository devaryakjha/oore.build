import * as z from 'zod/mini'

const apiErrorSchema = z.object({
  code: z.string(),
  details: z.nullish(z.string()),
  error: z.string(),
})

interface ApiErrorBody {
  readonly code: string
  readonly details?: string | null
  readonly error: string
}

export class ApiClientError extends Error {
  readonly code: string
  readonly details: string | null | undefined
  readonly status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.error)
    this.name = 'ApiClientError'
    this.code = body.code
    this.details = body.details
    this.status = status
  }
}

export async function readApiError(response: Response): Promise<ApiErrorBody> {
  try {
    return apiErrorSchema.parse(await response.json())
  } catch {
    return {
      code: 'unknown_error',
      error: `Request failed with status ${response.status}`,
    }
  }
}

export function getApiErrorMessage(
  cause: unknown,
  codeMap: Record<string, string>,
): string {
  if (cause instanceof ApiClientError) {
    return codeMap[cause.code] ?? cause.message
  }
  if (cause instanceof Error) return cause.message
  return 'An unexpected error occurred. Please try again.'
}
