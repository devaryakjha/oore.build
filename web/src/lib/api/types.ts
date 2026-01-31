/**
 * API Types - Re-exports from shared types generated from Rust.
 *
 * These types are auto-generated from Rust structs.
 * Run `make types` to regenerate after Rust model changes.
 */

// Re-export all generated types
export type {
  // Repository
  RepositoryResponse as Repository,
  CreateRepositoryRequest,
  UpdateRepositoryRequest,

  // Build
  BuildResponse as Build,
  BuildStatus,
  TriggerType,
  TriggerBuildRequest,
  ConfigSource,

  // Build Steps
  BuildStepResponse as BuildStep,
  StepStatus,

  // Build Logs
  BuildLogResponse,
  BuildLogContentResponse as BuildLogContent,
  LogStream,

  // Artifacts
  BuildArtifactResponse as BuildArtifact,

  // Pipeline
  PipelineConfigResponse as PipelineConfig,
  CreatePipelineConfigRequest,
  StoredConfigFormat as ConfigFormat,

  // Webhooks
  WebhookEventResponse as WebhookEvent,

  // Git Provider
  GitProvider,

  // Signing - iOS
  IosCertificateResponse as IosCertificate,
  IosProfileResponse as IosProfile,
  CertificateType,
  ProfileType,
  UploadCertificateRequest,
  UploadProfileRequest,
  AppStoreConnectApiKeyResponse as AppStoreConnectApiKey,
  UploadApiKeyRequest,
  IosSigningStatus,

  // Signing - Android
  AndroidKeystoreResponse as AndroidKeystore,
  KeystoreType,
  UploadKeystoreRequest,
  AndroidSigningStatus,

  // Signing Status
  SigningStatusResponse as SigningStatus,
} from '@oore/types'

// ============================================================================
// Types NOT in Rust (web-only or from oauth modules)
// These need to be manually maintained until we export them from Rust
// ============================================================================

// Setup status types
export interface GitHubAppStatus {
  configured: boolean
  app_name?: string
  app_id?: number
  app_slug?: string
  html_url?: string
  installations_count?: number
  created_at?: string
}

export interface GitLabCredentialsStatus {
  id: string
  configured: boolean
  instance_url?: string
  username?: string
  user_id?: number
  token_expires_at?: string
  needs_refresh: boolean
  enabled_projects_count: number
}

export interface SetupStatus {
  github: GitHubAppStatus
  gitlab: GitLabCredentialsStatus[]
  encryption_configured: boolean
  admin_token_configured: boolean
  /** Whether demo mode is enabled (all data is fake/simulated) */
  demo_mode?: boolean
}

export interface WebhookUrlResponse {
  webhook_url: string
  provider: string
}

// GitHub types
export interface GitHubManifestResponse {
  manifest: Record<string, unknown>
  create_url: string
  state: string
}

export interface GitHubSetupStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'not_found' | 'error'
  message: string
  app_name?: string
  app_id?: number
  app_slug?: string
}

export interface GitHubInstallation {
  installation_id: number
  account_login: string
  account_type: string
  repository_selection: string
  is_active: boolean
}

export interface GitHubInstallationsResponse {
  installations: GitHubInstallation[]
}

export interface GitHubSyncResponse {
  message: string
  installations_synced: number
  repositories_synced: number
}

export interface GitHubInstallationRepository {
  github_repository_id: number
  full_name: string
  is_private: boolean
}

export interface GitHubInstallationRepositoriesResponse {
  repositories: GitHubInstallationRepository[]
}

// GitLab types
export interface GitLabConnectRequest {
  instance_url?: string
  replace?: boolean
}

export interface GitLabConnectResponse {
  auth_url: string
  instance_url: string
  state: string
}

export interface GitLabSetupRequest {
  instance_url?: string
}

export interface GitLabSetupResponse {
  auth_url: string
  instance_url: string
  state: string
}

export interface GitLabSetupStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'not_found' | 'error'
  message: string
  username?: string
  instance_url?: string
}

export interface GitLabCredentials {
  id: string
  instance_url: string
  username: string
  user_id: number
  token_expires_at?: string
  needs_refresh: boolean
  enabled_projects_count: number
  is_active: boolean
  created_at: string
}

export interface GitLabProject {
  id: number
  name: string
  path_with_namespace: string
  web_url: string
  default_branch?: string
  ci_enabled: boolean
}

export interface GitLabProjectsResponse {
  projects: GitLabProject[]
  total: number
  page: number
  per_page: number
}

export interface GitLabEnableProjectResponse {
  message: string
  repository_id: string
  webhook_url: string
  webhook_secret: string
}

// Validation response (not in Rust yet)
export interface ValidatePipelineResponse {
  valid: boolean
  error?: string
  workflows?: string[]
}

// Error response
export interface ErrorResponse {
  error: {
    code: string
    message: string
  }
}
