import { demoApi } from './api'
import { HttpResponse, delay } from 'msw'
import * as z from 'zod'
import { ago } from '../seed'
import { getDemoPersonaFromRequest } from '../personas'
import { requireDemoInstancePermission } from '../authorization'
import { demoState } from '../state'

function requireAdmin(request: Request): Response | null {
  const { role } = getDemoPersonaFromRequest(request)
  if (role === 'owner' || role === 'admin') return null
  return HttpResponse.json(
    {
      error: 'You do not have permission to access this resource.',
      code: 'forbidden',
    },
    { status: 403 },
  )
}

export const userHandlers = [
  demoApi.listUsers(async ({ request }) => {
    await delay(150)
    const forbidden = requireAdmin(request)
    if (forbidden) return forbidden
    const url = new URL(request.url)
    const query = url.searchParams.get('q')?.toLowerCase()
    const sort = url.searchParams.get('sort') ?? 'created_at'
    const direction = url.searchParams.get('direction') === 'asc' ? 1 : -1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
    const users = demoState.users
      .filter((user) =>
        query
          ? [user.email, user.display_name, user.role, user.status]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(query))
          : true,
      )
      .slice()
      .sort((left, right) => {
        const leftValue =
          sort === 'email'
            ? left.email
            : sort === 'role'
              ? left.role
              : sort === 'status'
                ? left.status
                : left.created_at
        const rightValue =
          sort === 'email'
            ? right.email
            : sort === 'role'
              ? right.role
              : sort === 'status'
                ? right.status
                : right.created_at
        return direction * String(leftValue).localeCompare(String(rightValue))
      })
    return HttpResponse.json({
      users: users.slice(offset, offset + limit),
      total: users.length,
    })
  }),

  demoApi.inviteUser(async ({ request }) => {
    await delay(300)
    const forbidden = requireDemoInstancePermission(request, 'users:invite')
    if (forbidden) return forbidden
    const body = z
      .object({
        email: z.string(),
        role: z.enum(['owner', 'admin', 'developer', 'qa_viewer']),
      })
      .parse(await request.json())
    const user = {
      id: `usr-demo-new-${crypto.randomUUID().slice(0, 8)}`,
      email: body.email,
      role: body.role,
      status: 'invited' as const,
      created_at: ago(0),
      updated_at: ago(0),
    }
    demoState.users.push(user)
    return HttpResponse.json({ user }, { status: 201 })
  }),

  demoApi.updateUserRole(async ({ params, request }) => {
    await delay(200)
    const forbidden = requireDemoInstancePermission(request, 'users:write')
    if (forbidden) return forbidden
    const body = z
      .object({ role: z.enum(['owner', 'admin', 'developer', 'qa_viewer']) })
      .parse(await request.json())
    const user = demoState.users.find(
      (candidate) => candidate.id === params.user_id,
    )
    if (!user) {
      return HttpResponse.json(
        { error: 'User not found', code: 'not_found' },
        { status: 404 },
      )
    }
    user.role = body.role
    user.updated_at = ago(0)
    return HttpResponse.json({ user })
  }),

  demoApi.reEnableUser(async ({ params, request }) => {
    await delay(200)
    const forbidden = requireDemoInstancePermission(request, 'users:enable')
    if (forbidden) return forbidden
    const user = demoState.users.find(
      (candidate) => candidate.id === params.user_id,
    )
    if (!user) {
      return HttpResponse.json(
        { error: 'User not found', code: 'not_found' },
        { status: 404 },
      )
    }
    user.status = 'active'
    user.updated_at = ago(0)
    return HttpResponse.json({ user })
  }),

  demoApi.deleteUser(async ({ params, request }) => {
    await delay(200)
    const forbidden = requireDemoInstancePermission(request, 'users:delete')
    if (forbidden) return forbidden
    const index = demoState.users.findIndex(
      (candidate) => candidate.id === params.user_id,
    )
    if (index < 0) {
      return HttpResponse.json(
        { error: 'User not found', code: 'not_found' },
        { status: 404 },
      )
    }
    demoState.users.splice(index, 1)
    for (const roles of Object.values(demoState.projectRoles)) {
      if (roles) delete roles[String(params.user_id)]
    }
    return HttpResponse.json({ ok: true })
  }),
]
