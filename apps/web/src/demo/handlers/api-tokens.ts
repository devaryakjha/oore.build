import { HttpResponse, delay, http } from 'msw'
import * as z from 'zod'
import { getDemoPersonaFromRequest } from '../personas'
import { requireDemoInstancePermission } from '../authorization'
import { ago } from '../seed'
import { demoState } from '../state'

function tokenStatus(token: (typeof demoState.apiTokens)[number]) {
  if (token.is_revoked) return 'revoked'
  if (token.is_expired) return 'expired'
  return 'active'
}

export const apiTokenHandlers = [
  http.get('/v1/api-tokens', async ({ request }) => {
    await delay(150)
    const persona = getDemoPersonaFromRequest(request)
    if (persona.role === 'qa_viewer') {
      return HttpResponse.json(
        {
          error: 'You do not have permission to access this resource.',
          code: 'forbidden',
        },
        { status: 403 },
      )
    }

    const visibleTokens =
      persona.role === 'owner' || persona.role === 'admin'
        ? demoState.apiTokens
        : demoState.apiTokens.filter(
            (token) => token.created_by === persona.userId,
          )
    const url = new URL(request.url)
    const query = url.searchParams.get('q')?.toLowerCase()
    const sort = url.searchParams.get('sort') ?? 'created_at'
    const direction = url.searchParams.get('direction') === 'asc' ? 1 : -1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
    const tokens = visibleTokens
      .filter((token) =>
        query
          ? [
              token.name,
              token.prefix,
              token.role,
              token.created_by_email,
              tokenStatus(token),
            ].some((value) => value.toLowerCase().includes(query))
          : true,
      )
      .slice()
      .sort((left, right) => {
        const result =
          sort === 'name'
            ? left.name.localeCompare(right.name)
            : sort === 'role'
              ? left.role.localeCompare(right.role)
              : sort === 'status'
                ? tokenStatus(left).localeCompare(tokenStatus(right))
                : sort === 'last_used_at'
                  ? (left.last_used_at ?? 0) - (right.last_used_at ?? 0)
                  : left.created_at - right.created_at
        return direction * result
      })
    return HttpResponse.json({
      tokens: tokens.slice(offset, offset + limit),
      total: tokens.length,
    })
  }),

  http.post('/v1/api-tokens', async ({ request }) => {
    await delay(200)
    const forbidden = requireDemoInstancePermission(request, 'api_tokens:write')
    if (forbidden) return forbidden
    const persona = getDemoPersonaFromRequest(request)
    const body = z
      .object({
        name: z.string(),
        role: z.enum(['owner', 'admin', 'developer', 'qa_viewer']),
        expires_at: z.number().optional(),
      })
      .parse(await request.json())
    if (
      persona.role === 'developer' &&
      body.role !== 'developer' &&
      body.role !== 'qa_viewer'
    ) {
      return HttpResponse.json(
        {
          error: 'You cannot create a token with a higher role.',
          code: 'forbidden',
        },
        { status: 403 },
      )
    }
    const id = `token-demo-new-${Date.now()}`
    const createdAt = ago(0)
    demoState.apiTokens.unshift({
      id,
      name: body.name,
      prefix: `oore_${id.slice(-6)}`,
      role: body.role,
      created_by: persona.userId,
      created_by_email: persona.email,
      created_at: createdAt,
      expires_at: body.expires_at ?? null,
      last_used_at: null,
      is_expired: false,
      is_revoked: false,
    })
    return HttpResponse.json({
      id,
      name: body.name,
      prefix: `oore_${id.slice(-6)}`,
      role: body.role,
      created_at: createdAt,
      expires_at: body.expires_at ?? null,
      token: `oore_demo_${crypto.randomUUID().replaceAll('-', '')}`,
    })
  }),

  http.delete('/v1/api-tokens/:tokenId', async ({ params, request }) => {
    await delay(150)
    const forbidden = requireDemoInstancePermission(
      request,
      'api_tokens:delete',
    )
    if (forbidden) return forbidden
    const persona = getDemoPersonaFromRequest(request)
    const token = demoState.apiTokens.find(
      (candidate) => candidate.id === params.tokenId,
    )
    if (!token) {
      return HttpResponse.json(
        { error: 'Token not found', code: 'not_found' },
        { status: 404 },
      )
    }
    if (persona.role === 'developer' && token.created_by !== persona.userId) {
      return HttpResponse.json(
        {
          error: 'You do not have permission to revoke this token.',
          code: 'forbidden',
        },
        { status: 403 },
      )
    }
    token.is_revoked = true
    return HttpResponse.json({ revoked: true })
  }),
]
