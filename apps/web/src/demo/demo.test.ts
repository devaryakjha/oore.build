import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import * as z from 'zod'
import { isDemoMutationAllowed } from '@/lib/demo-mode'
import { allHandlers } from './handlers'
import { DEMO_PERSONAS } from './personas'
import { INTEGRATION_IDS, PIPELINE_IDS, PROJECT_IDS, USER_IDS } from './seed'
import {
  EXTRA_PIPELINE_IDS,
  EXTRA_PROJECT_IDS,
  PAGINATED_PIPELINE_PROJECT_ID,
  demoState,
  resetDemoState,
} from './state'

const server = setupServer(...allHandlers)
const demoOrigin = window.location.origin
const pipelineListSchema = z.object({
  pipelines: z.array(z.object({ name: z.string() })),
  total: z.number(),
})
const createdProjectSchema = z.object({
  project: z.object({ id: z.string() }),
})
const tokenListSchema = z.object({
  tokens: z.array(z.object({ created_by: z.string().optional() })),
})

function persona(role: (typeof DEMO_PERSONAS)[number]['role']) {
  return DEMO_PERSONAS.find((candidate) => candidate.role === role)!
}

function headers(role: (typeof DEMO_PERSONAS)[number]['role']) {
  return { Authorization: `Bearer ${persona(role).token}` }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  resetDemoState()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('demo authentication and RBAC', () => {
  it('returns 401 for missing and invalid protected credentials', async () => {
    const [missing, invalid] = await Promise.all([
      fetch(`${demoOrigin}/v1/users/me`),
      fetch(`${demoOrigin}/v1/projects`, {
        headers: { Authorization: 'Bearer not-a-demo-token' },
      }),
    ])
    expect(missing.status).toBe(401)
    expect(invalid.status).toBe(401)
    await expect(missing.json()).resolves.toMatchObject({
      code: 'unauthorized',
    })
    await expect(invalid.json()).resolves.toMatchObject({
      code: 'unauthorized',
    })
  })

  it('returns JSON 404 for an unassigned project', async () => {
    const response = await fetch(
      `${demoOrigin}/v1/projects/${PROJECT_IDS.internalAdmin}`,
      { headers: headers('developer') },
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toMatchObject({ code: 'not_found' })
  })

  it('keeps instance settings and user inventory admin-only', async () => {
    const [users, preferences] = await Promise.all([
      fetch(`${demoOrigin}/v1/users`, { headers: headers('developer') }),
      fetch(`${demoOrigin}/v1/settings/preferences`, {
        headers: headers('developer'),
      }),
    ])

    expect(users.status).toBe(403)
    expect(preferences.status).toBe(403)
    await expect(users.json()).resolves.toMatchObject({ code: 'forbidden' })
    await expect(preferences.json()).resolves.toMatchObject({
      code: 'forbidden',
    })
  })

  it('scopes eligible member candidates to project maintainers', async () => {
    const [maintainer, viewer] = await Promise.all([
      fetch(
        `${demoOrigin}/v1/projects/${PROJECT_IDS.flutterShop}/members/candidates`,
        { headers: headers('developer') },
      ),
      fetch(
        `${demoOrigin}/v1/projects/${PROJECT_IDS.nativePayments}/members/candidates`,
        { headers: headers('developer') },
      ),
    ])

    expect(maintainer.status).toBe(200)
    await expect(maintainer.json()).resolves.toEqual({
      candidates: [
        expect.objectContaining({ id: USER_IDS.invited, role: 'developer' }),
      ],
    })
    expect(viewer.status).toBe(403)
  })

  it('enforces instance and project permissions', async () => {
    const developerHeaders = {
      ...headers('developer'),
      'Content-Type': 'application/json',
    }

    const [
      invite,
      createProject,
      updateViewerProject,
      relinkMaintainerProject,
      runDeveloperProject,
    ] = await Promise.all([
      fetch(`${demoOrigin}/v1/users/invite`, {
        method: 'POST',
        headers: developerHeaders,
        body: JSON.stringify({
          email: 'demo+new@oore.build',
          role: 'developer',
        }),
      }),
      fetch(`${demoOrigin}/v1/projects`, {
        method: 'POST',
        headers: developerHeaders,
        body: JSON.stringify({ name: 'Developer project' }),
      }),
      fetch(`${demoOrigin}/v1/projects/${PROJECT_IDS.nativePayments}`, {
        method: 'PATCH',
        headers: developerHeaders,
        body: JSON.stringify({ name: 'Should not change' }),
      }),
      fetch(`${demoOrigin}/v1/projects/${PROJECT_IDS.flutterShop}`, {
        method: 'PATCH',
        headers: developerHeaders,
        body: JSON.stringify({ repository_id: 'repo-other' }),
      }),
      fetch(
        `${demoOrigin}/v1/projects/${EXTRA_PROJECT_IDS.developerTools}/builds`,
        {
          method: 'POST',
          headers: developerHeaders,
          body: JSON.stringify({
            pipeline_id: EXTRA_PIPELINE_IDS.developerTools,
          }),
        },
      ),
    ])

    expect(invite.status).toBe(403)
    expect(createProject.status).toBe(403)
    await expect(createProject.json()).resolves.toMatchObject({
      code: 'forbidden',
    })
    expect(updateViewerProject.status).toBe(403)
    expect(relinkMaintainerProject.status).toBe(403)
    expect(runDeveloperProject.status).toBe(200)

    const runViewerProject = await fetch(
      `${demoOrigin}/v1/projects/${PROJECT_IDS.nativePayments}/builds`,
      {
        method: 'POST',
        headers: developerHeaders,
        body: JSON.stringify({ pipeline_id: PIPELINE_IDS.paymentsAll }),
      },
    )
    expect(runViewerProject.status).toBe(403)

    const [deleteViewerProject, deleteViewerPipeline, manageViewerMembers] =
      await Promise.all([
        fetch(`${demoOrigin}/v1/projects/${PROJECT_IDS.nativePayments}`, {
          method: 'DELETE',
          headers: developerHeaders,
        }),
        fetch(`${demoOrigin}/v1/pipelines/${PIPELINE_IDS.paymentsAll}`, {
          method: 'DELETE',
          headers: developerHeaders,
        }),
        fetch(
          `${demoOrigin}/v1/projects/${PROJECT_IDS.nativePayments}/members/${USER_IDS.qaViewer}`,
          {
            method: 'PATCH',
            headers: developerHeaders,
            body: JSON.stringify({ role: 'viewer' }),
          },
        ),
      ])
    expect(deleteViewerProject.status).toBe(403)
    expect(deleteViewerPipeline.status).toBe(403)
    expect(manageViewerMembers.status).toBe(403)

    const manageMaintainerMembers = await fetch(
      `${demoOrigin}/v1/projects/${PROJECT_IDS.flutterShop}/members/${USER_IDS.qaViewer}`,
      {
        method: 'PATCH',
        headers: developerHeaders,
        body: JSON.stringify({ role: 'viewer' }),
      },
    )
    expect(manageMaintainerMembers.status).toBe(200)

    const deleteMaintainerPipeline = await fetch(
      `${demoOrigin}/v1/pipelines/${PIPELINE_IDS.shopAndroid}`,
      { method: 'DELETE', headers: developerHeaders },
    )
    expect(deleteMaintainerPipeline.status).toBe(204)

    const deleteMaintainerProject = await fetch(
      `${demoOrigin}/v1/projects/${PROJECT_IDS.flutterShop}`,
      { method: 'DELETE', headers: developerHeaders },
    )
    expect(deleteMaintainerProject.status).toBe(204)
  })

  it('keeps hosted demo writes blocked and local demo writes interactive', async () => {
    expect(
      isDemoMutationAllowed('POST', '/v1/projects', 'demo.oore.build'),
    ).toBe(false)
    expect(isDemoMutationAllowed('POST', '/v1/projects', 'localhost')).toBe(
      true,
    )
    expect(
      isDemoMutationAllowed(
        'POST',
        '/v1/artifacts/art-001/download-link',
        'demo.oore.build',
      ),
    ).toBe(true)
    const projectCount = demoState.projects.length
    const hostedWrite = await fetch('https://demo.oore.build/v1/projects', {
      method: 'POST',
      headers: {
        ...headers('owner'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Must stay read-only' }),
    })
    expect(hostedWrite.status).toBe(403)
    await expect(hostedWrite.json()).resolves.toMatchObject({
      code: 'demo_read_only',
    })
    expect(demoState.projects).toHaveLength(projectCount)
  })
})

describe('interactive demo API', () => {
  it('matches backend pipeline search, sorting, and pagination', async () => {
    const page = await fetch(
      `${demoOrigin}/v1/projects/${PAGINATED_PIPELINE_PROJECT_ID}/pipelines?sort=name&direction=asc&limit=20&offset=20`,
      { headers: headers('owner') },
    )
    const pageBody = pipelineListSchema.parse(await page.json())

    expect(page.status).toBe(200)
    expect(pageBody.total).toBe(25)
    const pageNames = pageBody.pipelines.map((pipeline) => pipeline.name)
    expect(pageNames).toHaveLength(5)
    expect(pageNames).toEqual([...pageNames].sort())

    const search = await fetch(
      `${demoOrigin}/v1/projects/${PAGINATED_PIPELINE_PROJECT_ID}/pipelines?search=%20RELEASE%20candidate%20&sort=name&direction=desc&limit=4&offset=0`,
      { headers: headers('owner') },
    )
    const searchBody = pipelineListSchema.parse(await search.json())

    expect(search.status).toBe(200)
    expect(searchBody.total).toBe(9)
    const searchNames = searchBody.pipelines.map((pipeline) => pipeline.name)
    expect(searchNames).toHaveLength(4)
    expect(searchNames).toEqual([...searchNames].sort().reverse())
  })

  it('serves degraded and setup scenario behavior', async () => {
    resetDemoState('degraded')
    const [repositories, update] = await Promise.all([
      fetch(
        `${demoOrigin}/v1/integrations/${INTEGRATION_IDS.github}/repositories`,
        { headers: headers('owner') },
      ),
      fetch(`${demoOrigin}/v1/system/update`, { headers: headers('owner') }),
    ])
    expect(repositories.status).toBe(503)
    await expect(update.json()).resolves.toMatchObject({ phase: 'failed' })

    resetDemoState('setup')
    const setup = await fetch(`${demoOrigin}/v1/public/setup-status`)
    await expect(setup.json()).resolves.toMatchObject({
      state: 'bootstrap_pending',
      is_configured: false,
    })
  })

  it('persists create, update, and delete mutations in the session graph', async () => {
    const ownerHeaders = {
      ...headers('owner'),
      'Content-Type': 'application/json',
    }
    const create = await fetch(`${demoOrigin}/v1/projects`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ name: 'Session Project' }),
    })
    const created = createdProjectSchema.parse(await create.json())

    const update = await fetch(
      `${demoOrigin}/v1/projects/${created.project.id}`,
      {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({ name: 'Updated Session Project' }),
      },
    )
    await expect(update.json()).resolves.toMatchObject({
      project: { name: 'Updated Session Project' },
    })

    const list = await fetch(
      `${demoOrigin}/v1/projects?search=updated%20session`,
      { headers: headers('owner') },
    )
    await expect(list.json()).resolves.toMatchObject({ total: 1 })

    const remove = await fetch(
      `${demoOrigin}/v1/projects/${created.project.id}`,
      { method: 'DELETE', headers: ownerHeaders },
    )
    expect(remove.status).toBe(204)
    const missing = await fetch(
      `${demoOrigin}/v1/projects/${created.project.id}`,
      { headers: headers('owner') },
    )
    expect(missing.status).toBe(404)
  })

  it('lists API tokens with backend role scope', async () => {
    const [ownerResponse, developerResponse] = await Promise.all([
      fetch(`${demoOrigin}/v1/api-tokens`, { headers: headers('owner') }),
      fetch(`${demoOrigin}/v1/api-tokens`, { headers: headers('developer') }),
    ])
    const ownerBody = tokenListSchema.parse(await ownerResponse.json())
    const developerBody = tokenListSchema.parse(await developerResponse.json())
    expect(ownerBody.tokens.length).toBeGreaterThan(developerBody.tokens.length)
    expect(developerBody.tokens.length).toBeGreaterThan(0)
    expect(
      developerBody.tokens.every(
        (token) => token.created_by === USER_IDS.developer,
      ),
    ).toBe(true)
  })
})
