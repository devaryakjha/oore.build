import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configureExternalAccessOidc,
  createArtifactInstallLink,
  createScopedDownloadToken,
  discoverRepositoryWorkflows,
  getArtifactDownloadLink,
  getRepositoryAvatar,
  listAllIntegrations,
  listAllPipelines,
  listAllProjects,
  listIntegrationRepos,
  listBuildArtifacts,
  listBuilds,
  listAuditLogs,
  listProjectArtifacts,
  listProjects,
  updatePipeline,
  validatePipeline,
} from '@/lib/api'

// ── Mock global fetch ──────────────────────────────────────────

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

function mockJsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('query cancellation', () => {
  it('passes the TanStack signal through build requests', async () => {
    const controller = new AbortController()
    mockFetch.mockReturnValue(mockJsonResponse(200, { builds: [], total: 0 }))

    await listBuilds('https://ci.example.com', 'token', undefined, {
      signal: controller.signal,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/builds',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        signal: controller.signal,
      }),
    )
  })

  it('queries an artifact batch with bearer auth and cancellation', async () => {
    const controller = new AbortController()
    mockFetch.mockReturnValue(mockJsonResponse(200, { artifacts: [] }))

    await listBuildArtifacts(
      'https://ci.example.com',
      'token',
      { build_ids: ['build-1', 'build-2'] },
      { signal: controller.signal },
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/artifacts/query',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ build_ids: ['build-1', 'build-2'] }),
        signal: controller.signal,
      },
    )
  })

  it('encodes collection sorting and forwards cancellation to GET requests', async () => {
    const controller = new AbortController()
    mockFetch.mockReturnValue(mockJsonResponse(200, {}))

    await listProjects(
      'https://ci.example.com',
      'token',
      { search: 'shop', sort: 'name', direction: 'asc', limit: 20, offset: 20 },
      { signal: controller.signal },
    )
    await listBuilds(
      'https://ci.example.com',
      'token',
      {
        status: ['failed', 'timed_out'],
        sort: 'project_name',
        direction: 'desc',
      },
      { signal: controller.signal },
    )
    await listAuditLogs(
      'https://ci.example.com',
      'token',
      { sort: 'action', direction: 'asc' },
      { signal: controller.signal },
    )

    const request = {
      headers: { Authorization: 'Bearer token' },
      signal: controller.signal,
    }
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://ci.example.com/v1/projects?search=shop&sort=name&direction=asc&limit=20&offset=20',
      request,
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://ci.example.com/v1/builds?status=failed%2Ctimed_out&sort=project_name&direction=desc',
      request,
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://ci.example.com/v1/audit-logs?sort=action&direction=asc',
      request,
    )
  })

  it('requests bounded project artifact history with cancellation', async () => {
    const controller = new AbortController()
    mockFetch.mockReturnValue(mockJsonResponse(200, { artifacts: [] }))

    await listProjectArtifacts(
      'https://ci.example.com',
      'token',
      'project-1',
      { limit: 50 },
      { signal: controller.signal },
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/projects/project-1/artifacts?limit=50',
      {
        headers: { Authorization: 'Bearer token' },
        signal: controller.signal,
      },
    )
  })

  it('loads every integration page for client-side collection controls', async () => {
    const controller = new AbortController()
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      id: `integration-${index}`,
    }))
    mockFetch
      .mockReturnValueOnce(
        mockJsonResponse(200, { integrations: firstPage, total: 202 }),
      )
      .mockReturnValueOnce(
        mockJsonResponse(200, {
          integrations: [{ id: 'integration-200' }, { id: 'integration-201' }],
          total: 202,
        }),
      )

    const result = await listAllIntegrations(
      'https://ci.example.com',
      'token',
      undefined,
      { signal: controller.signal },
    )

    expect(result.integrations).toHaveLength(202)
    expect(result.total).toBe(202)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://ci.example.com/v1/integrations?limit=200',
      expect.objectContaining({ signal: controller.signal }),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://ci.example.com/v1/integrations?limit=200&offset=200',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('loads every project page for full collection selectors', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      id: `project-${index}`,
    }))
    mockFetch
      .mockReturnValueOnce(
        mockJsonResponse(200, { projects: firstPage, total: 201 }),
      )
      .mockReturnValueOnce(
        mockJsonResponse(200, {
          projects: [{ id: 'project-200' }],
          total: 201,
        }),
      )

    const result = await listAllProjects('https://ci.example.com', 'token', {
      sort: 'name',
      direction: 'asc',
    })

    expect(result.projects).toHaveLength(201)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://ci.example.com/v1/projects?sort=name&direction=asc&limit=200',
      expect.any(Object),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://ci.example.com/v1/projects?sort=name&direction=asc&limit=200&offset=200',
      expect.any(Object),
    )
  })

  it('loads every repository page so each source can be approved', async () => {
    const controller = new AbortController()
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `repository-${index}`,
    }))
    mockFetch
      .mockReturnValueOnce(mockJsonResponse(200, { repositories: firstPage }))
      .mockReturnValueOnce(
        mockJsonResponse(200, { repositories: [{ id: 'repository-500' }] }),
      )

    const result = await listIntegrationRepos(
      'https://ci.example.com',
      'token',
      'integration-1',
      { signal: controller.signal },
    )

    expect(result.repositories).toHaveLength(501)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://ci.example.com/v1/integrations/integration-1/repositories?limit=500&offset=0',
      expect.objectContaining({ signal: controller.signal }),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://ci.example.com/v1/integrations/integration-1/repositories?limit=500&offset=500',
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})

describe('repository avatars', () => {
  it('fetches the image through Oore with the session token', async () => {
    const controller = new AbortController()
    const avatar = new Blob(['avatar'], { type: 'image/png' })
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(avatar),
    })

    const result = await getRepositoryAvatar(
      'https://oore.example.com',
      'session-token',
      'repo-1',
      { signal: controller.signal },
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://oore.example.com/v1/integration-repositories/repo-1/avatar',
      {
        headers: { Authorization: 'Bearer session-token' },
        signal: controller.signal,
      },
    )
    expect(result).toBe(avatar)
  })
})

describe('artifact download links', () => {
  it('replaces the daemon loopback fallback with the reachable instance origin', async () => {
    mockFetch
      .mockReturnValueOnce(
        mockJsonResponse(200, {
          download_url: 'http://127.0.0.1:8787/v1/artifacts/download/direct',
          expires_at: 1,
        }),
      )
      .mockReturnValueOnce(
        mockJsonResponse(200, {
          id: 'share-1',
          download_url: 'http://127.0.0.1:8787/install/artifact/scoped',
          token: 'scoped',
          prefix: 'scoped',
          expires_at: 1,
          single_use: false,
        }),
      )

    const direct = await getArtifactDownloadLink(
      'https://oore.example.com',
      'token',
      'artifact-1',
    )
    const scoped = await createScopedDownloadToken(
      'https://oore.example.com',
      'token',
      'artifact-1',
      {},
    )

    expect(direct.download_url).toBe(
      'https://oore.example.com/v1/artifacts/download/direct',
    )
    expect(scoped.download_url).toBe(
      'https://oore.example.com/install/artifact/scoped',
    )
  })

  it('keeps custom-protocol install URLs while normalizing HTTPS artifact URLs', async () => {
    mockFetch.mockReturnValue(
      mockJsonResponse(200, {
        platform: 'ios',
        install_url:
          'itms-services://?action=download-manifest&url=https%3A%2F%2Fci.example.com%2Fmanifest.plist',
        download_url: 'http://127.0.0.1:8787/install/artifact/install',
        manifest_url:
          'http://127.0.0.1:8787/install/ios/install/manifest.plist',
        expires_at: 1,
      }),
    )

    const result = await createArtifactInstallLink(
      'https://oore.example.com',
      'token',
      'artifact-1',
    )

    expect(result.install_url).toMatch(/^itms-services:/)
    expect(result.download_url).toBe(
      'https://oore.example.com/install/artifact/install',
    )
    expect(result.manifest_url).toBe(
      'https://oore.example.com/install/ios/install/manifest.plist',
    )
  })
})

describe('external access oidc api', () => {
  it('preserves the configured client secret when no replacement is provided', async () => {
    const payload = {
      discovered_issuer: 'https://accounts.google.com',
      has_client_secret: true,
      configured_at: 1700000000,
    }
    mockFetch.mockReturnValue(mockJsonResponse(200, payload))

    await configureExternalAccessOidc(
      'https://ci.example.com',
      'session-token',
      {
        issuer_url: 'https://accounts.google.com',
        client_id: 'my-client-id',
      },
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/settings/external-access/oidc',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
        },
        body: JSON.stringify({
          issuer_url: 'https://accounts.google.com',
          client_id: 'my-client-id',
        }),
      },
    )
  })
})

describe('pipeline api', () => {
  it('discovers repository workflows at an encoded ref and path', async () => {
    mockFetch.mockReturnValue(
      mockJsonResponse(200, {
        project_id: 'proj-1',
        provider: 'gitlab',
        reference: 'feature/mobile',
        workflows: [],
        truncated: false,
      }),
    )

    await discoverRepositoryWorkflows(
      'https://ci.example.com',
      'session-token',
      'proj-1',
      { reference: 'feature/mobile', path: '.oore/android release.yaml' },
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/projects/proj-1/repository-workflows?ref=feature%2Fmobile&path=.oore%2Fandroid+release.yaml',
      {
        headers: {
          Authorization: 'Bearer session-token',
        },
      },
    )
  })

  it('serializes explicit repository workflow mode', async () => {
    mockFetch.mockReturnValue(
      mockJsonResponse(200, { pipeline: { id: 'pipe-1' } }),
    )

    await updatePipeline('https://ci.example.com', 'session-token', 'pipe-1', {
      config_path: 'ci/mobile.yaml',
      config_path_explicit: true,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/pipelines/pipe-1',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
        },
        body: JSON.stringify({
          config_path: 'ci/mobile.yaml',
          config_path_explicit: true,
        }),
      },
    )
  })

  it('preserves independent execution fields during validation', async () => {
    mockFetch.mockReturnValue(
      mockJsonResponse(200, { valid: true, errors: [] }),
    )

    await validatePipeline('https://ci.example.com', 'session-token', {
      config_path_explicit: false,
      execution_config: {
        platforms: ['android', 'ios'],
        commands: { pre_build: [], build: ['echo custom'], post_build: [] },
        platform_build_args: {
          android: ['--build-number=$PROJECT_BUILD_NUMBER'],
          ios: [],
          macos: [],
        },
        platform_commands: {},
        env: [{ key: 'APP_FLAVOR', value: 'dev' }],
        artifact_patterns: ['*.apk', '*.ipa'],
      },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ci.example.com/v1/pipelines/validate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
        },
        body: JSON.stringify({
          config_path_explicit: false,
          execution_config: {
            platforms: ['android', 'ios'],
            commands: { pre_build: [], build: ['echo custom'], post_build: [] },
            platform_build_args: {
              android: ['--build-number=$PROJECT_BUILD_NUMBER'],
              ios: [],
              macos: [],
            },
            platform_commands: {},
            env: [{ key: 'APP_FLAVOR', value: 'dev' }],
            artifact_patterns: ['*.apk', '*.ipa'],
          },
        }),
      },
    )
  })

  it('loads every pipeline page for full selectors', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      id: `pipeline-${index}`,
    }))
    mockFetch
      .mockReturnValueOnce(
        mockJsonResponse(200, { pipelines: firstPage, total: 201 }),
      )
      .mockReturnValueOnce(
        mockJsonResponse(200, {
          pipelines: [{ id: 'pipeline-200' }],
          total: 201,
        }),
      )

    const result = await listAllPipelines(
      'https://ci.example.com',
      'session-token',
      'proj-1',
      { sort: 'name', direction: 'asc' },
    )

    expect(result.pipelines).toHaveLength(201)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://ci.example.com/v1/projects/proj-1/pipelines?sort=name&direction=asc&limit=200',
      expect.any(Object),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://ci.example.com/v1/projects/proj-1/pipelines?sort=name&direction=asc&limit=200&offset=200',
      expect.any(Object),
    )
  })
})
