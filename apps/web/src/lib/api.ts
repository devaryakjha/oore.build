import * as z from 'zod'
import type {
  ArtifactDownloadLinkResponse,
  ArtifactInstallLinkResponse,
  ArtifactStorageSettingsResponse,
  BootstrapTokenVerifyResponse,
  BrowseLocalGitDirectoriesResponse,
  BuildChangelogPreviewResponse,
  BuildDetailResponse,
  BuildLogsResponse,
  CancelBuildResponse,
  ConfigureExternalAccessOidcRequest,
  ConfigureExternalAccessOidcResponse,
  CreateBuildRequest,
  CreateBuildResponse,
  CreatePipelineRequest,
  CreatePipelineResponse,
  CreateScopedDownloadTokenRequest,
  CreateScopedDownloadTokenResponse,
  DiscoverRepositoryWorkflowsResponse,
  ExternalAccessNetworkSettingsResponse,
  ExternalAccessPreflightResponse,
  GetExternalAccessOidcResponse,
  GitHubAppStartRequest,
  GitHubAppStartResponse,
  GitLabAuthorizeRequest,
  GitLabAuthorizeResponse,
  GitLabCompleteResponse,
  GitLabCredentialStatusResponse,
  GitLabRepositoryWebhookSecretResponse,
  GitLabStartRequest,
  InstancePreferencesResponse,
  ListArtifactsResponse,
  ListBuildArtifactsRequest,
  ListAuditLogsResponse,
  ListBuildsResponse,
  ListInstallationsResponse,
  ListPipelineIosDevicesResponse,
  ListPipelinesResponse,
  LocalLoginRequest,
  LocalLoginResponse,
  OidcConfigureRequest,
  OidcConfigureResponse,
  PipelineAndroidSigningResponse,
  PipelineDetailResponse,
  PipelineIosSigningResponse,
  ReplaceGitLabTokenRequest,
  RegisterIosDeviceRequest,
  RegisterIosDeviceResponse,
  RerunBuildResponse,
  RetentionCleanupSummaryResponse,
  RetentionPolicyResponse,
  RuntimeUpdateStatus,
  SetupCompleteResponse,
  SetupLocalOwnerCreateResponse,
  SetupOidcStartResponse,
  SetupOidcVerifyResponse,
  SetupPreferencesRequest,
  SetupPreferencesResponse,
  SetupStatus,
  SetupSummaryResponse,
  SetupTrustedProxyClaimOwnerResponse,
  SyncInstallationsResponse,
  SyncPipelineIosSigningResponse,
  TrustedProxySettingsResponse,
  UpdateArtifactStorageSettingsRequest,
  UpdateExternalAccessNetworkSettingsRequest,
  UpdateInstancePreferencesRequest,
  UpdatePipelineAndroidSigningRequest,
  UpdatePipelineIosSigningRequest,
  UpdatePipelineRequest,
  UpdateRetentionPolicyRequest,
  UpdateTrustedProxySettingsRequest,
  ValidatePipelineRequest,
  ValidatePipelineResponse,
} from '@/lib/types'

import { ApiClientError, readApiError } from '@/lib/api-client/api-error'
import { READ_ONLY_REASON, isDemoMutationBlocked } from '@/lib/demo-mode'
import { isLoopbackUrl } from '@/lib/connectivity'

// ── Error class ─────────────────────────────────────────────────
export { ApiClientError } from '@/lib/api-client/api-error'

type RequestOptions = Pick<RequestInit, 'signal'>

// ── Fetch wrapper ───────────────────────────────────────────────

async function requestResponse(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
) {
  const method = (options.method ?? 'GET').toUpperCase()
  if (isDemoMutationBlocked(method, path)) {
    throw new ApiClientError(403, {
      error: READ_ONLY_REASON,
      code: 'demo_read_only',
    })
  }
  // Only set Content-Type on requests with a body. GET/HEAD without it
  // avoids triggering CORS preflight (important for tunneled backends).
  const headers: Record<string, string> = {}
  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      headers[key] = value
    })
  } else if (Array.isArray(options.headers)) {
    for (const [key, value] of options.headers) headers[key] = value
  } else if (options.headers) {
    Object.assign(headers, options.headers)
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    throw new ApiClientError(res.status, await readApiError(res))
  }

  return res
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await requestResponse(baseUrl, path, options)
  // SAFETY: Each exported wrapper fixes T to the documented response for its fixed path and method.
  return (await response.json()) as T
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// ── Error helpers ───────────────────────────────────────────────

export function getApiErrorMessage(
  cause: unknown,
  codeMap: Record<string, string>,
): string {
  if (cause instanceof ApiClientError) {
    return codeMap[cause.code] ?? cause.message
  }
  if (cause instanceof Error) {
    return cause.message
  }
  return 'An unexpected error occurred. Please try again.'
}

// ── API functions ───────────────────────────────────────────────

export function getSetupStatus(
  baseUrl: string,
  options?: RequestOptions,
): Promise<SetupStatus> {
  return request<SetupStatus>(baseUrl, '/v1/public/setup-status', {
    signal: options?.signal,
  })
}

interface BootstrapTokenVerification {
  baseUrl: string
  token: string
  promise: Promise<BootstrapTokenVerifyResponse>
}

let bootstrapTokenVerification: BootstrapTokenVerification | null = null

export function clearBootstrapTokenVerification(): void {
  bootstrapTokenVerification = null
}

export function verifyBootstrapToken(
  baseUrl: string,
  token: string,
): Promise<BootstrapTokenVerifyResponse> {
  if (
    bootstrapTokenVerification?.baseUrl === baseUrl &&
    bootstrapTokenVerification.token === token
  ) {
    return bootstrapTokenVerification.promise
  }

  const promise = request<BootstrapTokenVerifyResponse>(
    baseUrl,
    '/v1/setup/bootstrap-token/verify',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  )
  bootstrapTokenVerification = { baseUrl, token, promise }
  void promise.catch(() => {
    if (bootstrapTokenVerification?.promise === promise) {
      bootstrapTokenVerification = null
    }
  })
  return promise
}

export function configureOidc(
  baseUrl: string,
  sessionToken: string,
  data: OidcConfigureRequest,
): Promise<OidcConfigureResponse> {
  return request<OidcConfigureResponse>(baseUrl, '/v1/setup/oidc/configure', {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify(data),
  })
}

export function setupOidcStart(
  baseUrl: string,
  sessionToken: string,
  redirectUri: string,
): Promise<SetupOidcStartResponse> {
  return request<SetupOidcStartResponse>(
    baseUrl,
    '/v1/setup/owner/start-oidc',
    {
      method: 'POST',
      headers: authHeaders(sessionToken),
      body: JSON.stringify({ redirect_uri: redirectUri }),
    },
  )
}

export function setupOidcVerify(
  baseUrl: string,
  code: string,
  state: string,
): Promise<SetupOidcVerifyResponse> {
  return request<SetupOidcVerifyResponse>(
    baseUrl,
    '/v1/setup/owner/verify-oidc',
    {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    },
  )
}

export function setupLocalOwnerCreate(
  baseUrl: string,
  sessionToken: string,
  email: string,
): Promise<SetupLocalOwnerCreateResponse> {
  return request<SetupLocalOwnerCreateResponse>(
    baseUrl,
    '/v1/setup/local-owner/create',
    {
      method: 'POST',
      headers: authHeaders(sessionToken),
      body: JSON.stringify({ email }),
    },
  )
}

export function setupPreferences(
  baseUrl: string,
  sessionToken: string,
  data: SetupPreferencesRequest,
): Promise<SetupPreferencesResponse> {
  return request<SetupPreferencesResponse>(baseUrl, '/v1/setup/preferences', {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify(data),
  })
}

export function setupTrustedProxyClaimOwner(
  baseUrl: string,
  sessionToken: string,
): Promise<SetupTrustedProxyClaimOwnerResponse> {
  return request<SetupTrustedProxyClaimOwnerResponse>(
    baseUrl,
    '/v1/setup/owner/claim-trusted-proxy',
    {
      method: 'POST',
      headers: authHeaders(sessionToken),
    },
  )
}

export function completeSetup(
  baseUrl: string,
  sessionToken: string,
): Promise<SetupCompleteResponse> {
  return request<SetupCompleteResponse>(baseUrl, '/v1/setup/complete', {
    method: 'POST',
    headers: authHeaders(sessionToken),
  })
}

export function getSetupSummary(
  baseUrl: string,
  sessionToken: string,
  options?: RequestOptions,
): Promise<SetupSummaryResponse> {
  return request<SetupSummaryResponse>(baseUrl, '/v1/setup/summary', {
    headers: authHeaders(sessionToken),
    signal: options?.signal,
  })
}

// ── User management API ─────────────────────────────────────────

export function getBackendUpdateStatus(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<RuntimeUpdateStatus> {
  return request<RuntimeUpdateStatus>(baseUrl, '/v1/system/update', {
    headers: authHeaders(token),
    signal: options?.signal,
  })
}

export function startBackendUpdate(
  baseUrl: string,
  token: string,
): Promise<RuntimeUpdateStatus> {
  return request<RuntimeUpdateStatus>(baseUrl, '/v1/system/update', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function localLogin(
  baseUrl: string,
  data: LocalLoginRequest,
): Promise<LocalLoginResponse> {
  return request<LocalLoginResponse>(baseUrl, '/v1/auth/local/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function trustedProxyLogin(
  baseUrl: string,
): Promise<LocalLoginResponse> {
  return request<LocalLoginResponse>(baseUrl, '/v1/auth/trusted-proxy/login', {
    method: 'POST',
  })
}

// ── Integration API ─────────────────────────────────────────────

export function githubAppStart(
  baseUrl: string,
  token: string,
  data: GitHubAppStartRequest,
): Promise<GitHubAppStartResponse> {
  return request<GitHubAppStartResponse>(
    baseUrl,
    '/v1/integrations/github/start',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function syncInstallations(
  baseUrl: string,
  token: string,
  integrationId: string,
): Promise<SyncInstallationsResponse> {
  return request<SyncInstallationsResponse>(
    baseUrl,
    `/v1/integrations/${integrationId}/installations`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  )
}

export function listInstallations(
  baseUrl: string,
  token: string,
  integrationId: string,
  options?: RequestOptions,
): Promise<ListInstallationsResponse> {
  return request<ListInstallationsResponse>(
    baseUrl,
    `/v1/integrations/${integrationId}/installations`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function gitlabStart(
  baseUrl: string,
  token: string,
  data: GitLabStartRequest,
): Promise<GitLabCompleteResponse> {
  return request<GitLabCompleteResponse>(
    baseUrl,
    '/v1/integrations/gitlab/start',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function gitlabAuthorize(
  baseUrl: string,
  token: string,
  data: GitLabAuthorizeRequest,
): Promise<GitLabAuthorizeResponse> {
  return request<GitLabAuthorizeResponse>(
    baseUrl,
    '/v1/integrations/gitlab/authorize',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function checkGitLabToken(
  baseUrl: string,
  token: string,
  integrationId: string,
): Promise<GitLabCredentialStatusResponse> {
  return request<GitLabCredentialStatusResponse>(
    baseUrl,
    `/v1/integrations/${integrationId}/gitlab-token/check`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  )
}

export function replaceGitLabToken(
  baseUrl: string,
  token: string,
  integrationId: string,
  data: ReplaceGitLabTokenRequest,
): Promise<GitLabCredentialStatusResponse> {
  return request<GitLabCredentialStatusResponse>(
    baseUrl,
    `/v1/integrations/${integrationId}/gitlab-token`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function rotateGitLabRepositoryWebhookSecret(
  baseUrl: string,
  token: string,
  repositoryId: string,
): Promise<GitLabRepositoryWebhookSecretResponse> {
  return request<GitLabRepositoryWebhookSecretResponse>(
    baseUrl,
    `/v1/integration-repositories/${repositoryId}/gitlab-webhook-secret`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  )
}

export function browseLocalGitDirectories(
  baseUrl: string,
  token: string,
  path?: string,
  options?: RequestOptions,
): Promise<BrowseLocalGitDirectoriesResponse> {
  const params = new URLSearchParams()
  if (path?.trim()) {
    params.set('path', path.trim())
  }
  const query = params.toString()
  const endpoint = query
    ? `/v1/integrations/local-git/directories?${query}`
    : '/v1/integrations/local-git/directories'

  return request<BrowseLocalGitDirectoriesResponse>(baseUrl, endpoint, {
    headers: authHeaders(token),
    signal: options?.signal,
  })
}

// ── Runner API ─────────────────────────────────────────────────

export function getArtifactStorageSettings(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<ArtifactStorageSettingsResponse> {
  return request<ArtifactStorageSettingsResponse>(
    baseUrl,
    '/v1/settings/artifact-storage',
    {
      headers: authHeaders(token),
      signal: options?.signal,
    },
  )
}

export function updateArtifactStorageSettings(
  baseUrl: string,
  token: string,
  data: UpdateArtifactStorageSettingsRequest,
): Promise<ArtifactStorageSettingsResponse> {
  return request<ArtifactStorageSettingsResponse>(
    baseUrl,
    '/v1/settings/artifact-storage',
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function getInstancePreferences(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<InstancePreferencesResponse> {
  return request<InstancePreferencesResponse>(
    baseUrl,
    '/v1/settings/preferences',
    {
      headers: authHeaders(token),
      signal: options?.signal,
    },
  )
}

export function getExternalAccessPreflight(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<ExternalAccessPreflightResponse> {
  return request<ExternalAccessPreflightResponse>(
    baseUrl,
    '/v1/settings/external-access/preflight',
    {
      headers: authHeaders(token),
      signal: options?.signal,
    },
  )
}

export function getExternalAccessNetworkSettings(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<ExternalAccessNetworkSettingsResponse> {
  return request<ExternalAccessNetworkSettingsResponse>(
    baseUrl,
    '/v1/settings/external-access/network',
    {
      headers: authHeaders(token),
      signal: options?.signal,
    },
  )
}

export function updateExternalAccessNetworkSettings(
  baseUrl: string,
  token: string,
  data: UpdateExternalAccessNetworkSettingsRequest,
): Promise<ExternalAccessNetworkSettingsResponse> {
  return request<ExternalAccessNetworkSettingsResponse>(
    baseUrl,
    '/v1/settings/external-access/network',
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function getExternalAccessTrustedProxySettings(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<TrustedProxySettingsResponse> {
  return request<TrustedProxySettingsResponse>(
    baseUrl,
    '/v1/settings/external-access/trusted-proxy',
    {
      headers: authHeaders(token),
      signal: options?.signal,
    },
  )
}

export function updateExternalAccessTrustedProxySettings(
  baseUrl: string,
  token: string,
  data: UpdateTrustedProxySettingsRequest,
): Promise<TrustedProxySettingsResponse> {
  return request<TrustedProxySettingsResponse>(
    baseUrl,
    '/v1/settings/external-access/trusted-proxy',
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function getExternalAccessOidc(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<GetExternalAccessOidcResponse> {
  return request<GetExternalAccessOidcResponse>(
    baseUrl,
    '/v1/settings/external-access/oidc',
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function configureExternalAccessOidc(
  baseUrl: string,
  token: string,
  data: ConfigureExternalAccessOidcRequest,
): Promise<ConfigureExternalAccessOidcResponse> {
  return request<ConfigureExternalAccessOidcResponse>(
    baseUrl,
    '/v1/settings/external-access/oidc',
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function updateInstancePreferences(
  baseUrl: string,
  token: string,
  data: UpdateInstancePreferencesRequest,
): Promise<InstancePreferencesResponse> {
  return request<InstancePreferencesResponse>(
    baseUrl,
    '/v1/settings/preferences',
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

// ── Build API ──────────────────────────────────────────────────

export function createBuild(
  baseUrl: string,
  token: string,
  projectId: string,
  data: CreateBuildRequest,
): Promise<CreateBuildResponse> {
  return request<CreateBuildResponse>(
    baseUrl,
    `/v1/projects/${projectId}/builds`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function getBuildChangelogPreview(
  baseUrl: string,
  token: string,
  projectId: string,
  params: { pipeline_id: string; branch?: string; commit_sha?: string },
  options?: RequestOptions,
): Promise<BuildChangelogPreviewResponse> {
  const query = new URLSearchParams({ pipeline_id: params.pipeline_id })
  if (params.branch) query.set('branch', params.branch)
  if (params.commit_sha) query.set('commit_sha', params.commit_sha)
  return request<BuildChangelogPreviewResponse>(
    baseUrl,
    `/v1/projects/${projectId}/builds/changelog-preview?${query}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function listBuilds(
  baseUrl: string,
  token: string,
  params?: {
    project_id?: string
    pipeline_id?: string
    status?: string | ReadonlyArray<string>
    branch?: string
    sort?: 'created_at' | 'status' | 'project_name' | 'pipeline_name' | 'branch'
    direction?: 'asc' | 'desc'
    limit?: number
    offset?: number
  },
  options?: RequestOptions,
): Promise<ListBuildsResponse> {
  const query = new URLSearchParams()
  if (params?.project_id) query.set('project_id', params.project_id)
  if (params?.pipeline_id) query.set('pipeline_id', params.pipeline_id)
  const statusValue = z.string().safeParse(params?.status)
  const statusList = z.array(z.string()).safeParse(params?.status)
  const status = statusValue.success
    ? statusValue.data
    : statusList.success
      ? statusList.data.join(',')
      : undefined
  if (status) query.set('status', status)
  if (params?.branch) query.set('branch', params.branch)
  if (params?.sort) query.set('sort', params.sort)
  if (params?.direction) query.set('direction', params.direction)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  const qs = query.toString()
  return request<ListBuildsResponse>(
    baseUrl,
    `/v1/builds${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function getBuild(
  baseUrl: string,
  token: string,
  buildId: string,
  options?: RequestOptions,
): Promise<BuildDetailResponse> {
  return request<BuildDetailResponse>(baseUrl, `/v1/builds/${buildId}`, {
    headers: authHeaders(token),
    signal: options?.signal,
  })
}

export function cancelBuild(
  baseUrl: string,
  token: string,
  buildId: string,
): Promise<CancelBuildResponse> {
  return request<CancelBuildResponse>(baseUrl, `/v1/builds/${buildId}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function rerunBuild(
  baseUrl: string,
  token: string,
  buildId: string,
): Promise<RerunBuildResponse> {
  return request<RerunBuildResponse>(baseUrl, `/v1/builds/${buildId}/rerun`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

// ── Stream Token API ────────────────────────────────────────

export function createStreamToken(
  baseUrl: string,
  token: string,
  buildId: string,
): Promise<{ token: string; expires_at: number }> {
  return request<{ token: string; expires_at: number }>(
    baseUrl,
    `/v1/builds/${buildId}/stream-token`,
    { method: 'POST', headers: authHeaders(token) },
  )
}

// ── Build Logs API ──────────────────────────────────────────

export function getBuildLogs(
  baseUrl: string,
  token: string,
  buildId: string,
  params?: { after_sequence?: number; limit?: number },
  options?: RequestOptions,
): Promise<BuildLogsResponse> {
  const query = new URLSearchParams()
  if (params?.after_sequence != null)
    query.set('after_sequence', String(params.after_sequence))
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<BuildLogsResponse>(
    baseUrl,
    `/v1/builds/${buildId}/logs${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

// ── Artifact API ────────────────────────────────────────────

function resolveArtifactUrl(baseUrl: string, downloadUrl: string): string {
  if (!isLoopbackUrl(downloadUrl)) return downloadUrl

  try {
    const download = new URL(downloadUrl)
    const instance = new URL(baseUrl)
    if (download.origin === instance.origin) return downloadUrl
    return new URL(
      `${download.pathname}${download.search}${download.hash}`,
      instance,
    ).toString()
  } catch {
    return downloadUrl
  }
}

export function listArtifacts(
  baseUrl: string,
  token: string,
  buildId: string,
  options?: RequestOptions,
): Promise<ListArtifactsResponse> {
  return request<ListArtifactsResponse>(
    baseUrl,
    `/v1/builds/${buildId}/artifacts`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function listProjectArtifacts(
  baseUrl: string,
  token: string,
  projectId: string,
  params?: { limit?: number },
  options?: RequestOptions,
): Promise<ListArtifactsResponse> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<ListArtifactsResponse>(
    baseUrl,
    `/v1/projects/${projectId}/artifacts${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function listBuildArtifacts(
  baseUrl: string,
  token: string,
  data: ListBuildArtifactsRequest,
  options?: RequestOptions,
): Promise<ListArtifactsResponse> {
  return request<ListArtifactsResponse>(baseUrl, '/v1/artifacts/query', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
    signal: options?.signal,
  })
}

export function getArtifactDownloadLink(
  baseUrl: string,
  token: string,
  artifactId: string,
): Promise<ArtifactDownloadLinkResponse> {
  return request<ArtifactDownloadLinkResponse>(
    baseUrl,
    `/v1/artifacts/${artifactId}/download-link`,
    { method: 'POST', headers: authHeaders(token) },
  ).then((response) => ({
    ...response,
    download_url: resolveArtifactUrl(baseUrl, response.download_url),
  }))
}

export function createArtifactInstallLink(
  baseUrl: string,
  token: string,
  artifactId: string,
): Promise<ArtifactInstallLinkResponse> {
  return request<ArtifactInstallLinkResponse>(
    baseUrl,
    `/v1/artifacts/${artifactId}/install-link`,
    { method: 'POST', headers: authHeaders(token) },
  ).then((response) => ({
    ...response,
    download_url: resolveArtifactUrl(baseUrl, response.download_url),
    manifest_url: response.manifest_url
      ? resolveArtifactUrl(baseUrl, response.manifest_url)
      : undefined,
  }))
}

export function createScopedDownloadToken(
  baseUrl: string,
  token: string,
  artifactId: string,
  data: CreateScopedDownloadTokenRequest,
): Promise<CreateScopedDownloadTokenResponse> {
  return request<CreateScopedDownloadTokenResponse>(
    baseUrl,
    `/v1/artifacts/${artifactId}/scoped-token`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  ).then((response) => ({
    ...response,
    download_url: resolveArtifactUrl(baseUrl, response.download_url),
  }))
}

// ── Pipeline API ────────────────────────────────────────────────

export function listPipelines(
  baseUrl: string,
  token: string,
  projectId: string,
  params?: {
    search?: string
    sort?: 'created_at' | 'name'
    direction?: 'asc' | 'desc'
    limit?: number
    offset?: number
  },
  options?: RequestOptions,
): Promise<ListPipelinesResponse> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.sort) query.set('sort', params.sort)
  if (params?.direction) query.set('direction', params.direction)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  const qs = query.toString()
  return request<ListPipelinesResponse>(
    baseUrl,
    `/v1/projects/${projectId}/pipelines${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function discoverRepositoryWorkflows(
  baseUrl: string,
  token: string,
  projectId: string,
  params?: { reference?: string; path?: string },
  options?: RequestOptions,
): Promise<DiscoverRepositoryWorkflowsResponse> {
  const query = new URLSearchParams()
  if (params?.reference) query.set('ref', params.reference)
  if (params?.path) query.set('path', params.path)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  return request<DiscoverRepositoryWorkflowsResponse>(
    baseUrl,
    `/v1/projects/${projectId}/repository-workflows${suffix}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function getPipeline(
  baseUrl: string,
  token: string,
  pipelineId: string,
  options?: RequestOptions,
): Promise<PipelineDetailResponse> {
  return request<PipelineDetailResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function createPipeline(
  baseUrl: string,
  token: string,
  projectId: string,
  data: CreatePipelineRequest,
): Promise<CreatePipelineResponse> {
  return request<CreatePipelineResponse>(
    baseUrl,
    `/v1/projects/${projectId}/pipelines`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function updatePipeline(
  baseUrl: string,
  token: string,
  pipelineId: string,
  data: UpdatePipelineRequest,
): Promise<CreatePipelineResponse> {
  return request<CreatePipelineResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function deletePipeline(
  baseUrl: string,
  token: string,
  pipelineId: string,
): Promise<void> {
  return requestResponse(baseUrl, `/v1/pipelines/${pipelineId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }).then(() => undefined)
}

export function validatePipeline(
  baseUrl: string,
  token: string,
  data: ValidatePipelineRequest,
): Promise<ValidatePipelineResponse> {
  return request<ValidatePipelineResponse>(baseUrl, '/v1/pipelines/validate', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export function getPipelineAndroidSigning(
  baseUrl: string,
  token: string,
  pipelineId: string,
  options?: RequestOptions,
): Promise<PipelineAndroidSigningResponse> {
  return request<PipelineAndroidSigningResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/android-signing`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function updatePipelineAndroidSigning(
  baseUrl: string,
  token: string,
  pipelineId: string,
  data: UpdatePipelineAndroidSigningRequest,
): Promise<PipelineAndroidSigningResponse> {
  return request<PipelineAndroidSigningResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/android-signing`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function getPipelineIosSigning(
  baseUrl: string,
  token: string,
  pipelineId: string,
  options?: RequestOptions,
): Promise<PipelineIosSigningResponse> {
  return request<PipelineIosSigningResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/ios-signing`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function updatePipelineIosSigning(
  baseUrl: string,
  token: string,
  pipelineId: string,
  data: UpdatePipelineIosSigningRequest,
): Promise<PipelineIosSigningResponse> {
  return request<PipelineIosSigningResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/ios-signing`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

export function syncPipelineIosSigning(
  baseUrl: string,
  token: string,
  pipelineId: string,
): Promise<SyncPipelineIosSigningResponse> {
  return request<SyncPipelineIosSigningResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/ios-signing/sync`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  )
}

export function listPipelineIosDevices(
  baseUrl: string,
  token: string,
  pipelineId: string,
  options?: RequestOptions,
): Promise<ListPipelineIosDevicesResponse> {
  return request<ListPipelineIosDevicesResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/ios-signing/devices`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

export function registerPipelineIosDevice(
  baseUrl: string,
  token: string,
  pipelineId: string,
  data: RegisterIosDeviceRequest,
): Promise<RegisterIosDeviceResponse> {
  return request<RegisterIosDeviceResponse>(
    baseUrl,
    `/v1/pipelines/${pipelineId}/ios-signing/devices/register`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  )
}

// ── Notification channels ───────────────────────────────────────

export function getRetentionPolicy(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<RetentionPolicyResponse> {
  return request<RetentionPolicyResponse>(baseUrl, '/v1/settings/retention', {
    headers: authHeaders(token),
    signal: options?.signal,
  })
}

export function updateRetentionPolicy(
  baseUrl: string,
  token: string,
  data: UpdateRetentionPolicyRequest,
): Promise<RetentionPolicyResponse> {
  return request<RetentionPolicyResponse>(baseUrl, '/v1/settings/retention', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export function getRetentionLastCleanup(
  baseUrl: string,
  token: string,
  options?: RequestOptions,
): Promise<RetentionCleanupSummaryResponse> {
  return request<RetentionCleanupSummaryResponse>(
    baseUrl,
    '/v1/settings/retention/last-cleanup',
    { headers: authHeaders(token), signal: options?.signal },
  )
}

// ── Audit Logs ──────────────────────────────────────────────────

export function listAuditLogs(
  baseUrl: string,
  token: string,
  params?: {
    limit?: number
    offset?: number
    actor_id?: string
    action?: string
    resource_type?: string
    from_ts?: number
    to_ts?: number
    sort?: 'created_at' | 'actor_email' | 'action' | 'resource_type'
    direction?: 'asc' | 'desc'
  },
  options?: RequestOptions,
): Promise<ListAuditLogsResponse> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  if (params?.actor_id) query.set('actor_id', params.actor_id)
  if (params?.action) query.set('action', params.action)
  if (params?.resource_type) query.set('resource_type', params.resource_type)
  if (params?.from_ts) query.set('from_ts', String(params.from_ts))
  if (params?.to_ts) query.set('to_ts', String(params.to_ts))
  if (params?.sort) query.set('sort', params.sort)
  if (params?.direction) query.set('direction', params.direction)
  const qs = query.toString()
  return request<ListAuditLogsResponse>(
    baseUrl,
    `/v1/audit-logs${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token), signal: options?.signal },
  )
}

// ── API Tokens ──────────────────────────────────────────────────
