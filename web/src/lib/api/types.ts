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
}

// Repository types
export interface Repository {
  id: string
  name: string
  provider: 'github' | 'gitlab'
  owner: string
  repo_name: string
  clone_url: string
  default_branch: string
  is_active: boolean
  github_repository_id?: number
  github_installation_id?: number
  gitlab_project_id?: number
  created_at: string
  updated_at: string
}

export interface CreateRepositoryRequest {
  name?: string
  provider: string
  owner: string
  repo_name: string
  clone_url?: string
  default_branch?: string
  webhook_secret?: string
  github_repository_id?: number
  github_installation_id?: number
  gitlab_project_id?: number
}

export interface UpdateRepositoryRequest {
  name?: string
  default_branch?: string
  is_active?: boolean
  webhook_secret?: string
  github_installation_id?: number
  gitlab_project_id?: number
}

export interface WebhookUrlResponse {
  webhook_url: string
  provider: string
}

// Build types
export type BuildStatus = 'pending' | 'running' | 'success' | 'failure' | 'cancelled'
export type TriggerType = 'push' | 'pull_request' | 'merge_request' | 'manual'

export interface Build {
  id: string
  repository_id: string
  webhook_event_id?: string
  commit_sha: string
  branch: string
  trigger_type: TriggerType
  status: BuildStatus
  started_at?: string
  finished_at?: string
  created_at: string
}

export interface TriggerBuildRequest {
  branch?: string
  commit_sha?: string
}

// Webhook types
export interface WebhookEvent {
  id: string
  repository_id?: string
  provider: 'github' | 'gitlab'
  event_type: string
  delivery_id: string
  processed: boolean
  error_message?: string
  received_at: string
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
  default_branch: string
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

// Error response
export interface ErrorResponse {
  error: {
    code: string
    message: string
  }
}
