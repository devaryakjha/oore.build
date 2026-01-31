'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createRepository } from '@/lib/api/repositories'
import { useSetupStatus } from '@/lib/api/setup'
import { useGitHubInstallations, useGitHubInstallationRepositories } from '@/lib/api/github'
import { useGitLabCredentials, useGitLabProjects, refreshGitLabToken } from '@/lib/api/gitlab'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ArrowLeft02Icon,
  GithubIcon,
  GitlabIcon,
  Loading03Icon,
  ArrowRight01Icon,
  LockIcon,
  Edit02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function NewRepositoryPage() {
  const router = useRouter()

  // Form state
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github')
  const [owner, setOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [defaultBranch, setDefaultBranch] = useState('main')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [manualEntry, setManualEntry] = useState(false)

  // Selection state
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null)
  const [selectedGitHubRepoId, setSelectedGitHubRepoId] = useState<number | null>(null)
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null)
  const [selectedGitLabProjectId, setSelectedGitLabProjectId] = useState<number | null>(null)
  const [tokenRefreshing, setTokenRefreshing] = useState(false)
  const tokenRefreshingRef = useRef(false)

  // Data fetching
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { data: installations, isLoading: installationsLoading } = useGitHubInstallations()
  const { data: gitlabCredentials, isLoading: credentialsLoading } = useGitLabCredentials()
  const { data: githubRepos, isLoading: reposLoading } = useGitHubInstallationRepositories(selectedInstallationId)
  const selectedCredential = gitlabCredentials?.find(c => c.id === selectedCredentialId)
  const { data: gitlabProjects, isLoading: projectsLoading } = useGitLabProjects(selectedCredential?.instance_url ?? null)

  // Computed values
  const githubConfigured = setupStatus?.github.configured ?? false
  const gitlabConfigured = (setupStatus?.gitlab?.length ?? 0) > 0
  const hasIntegrations = provider === 'github' ? githubConfigured : gitlabConfigured
  const hasGitHubInstallations = (installations?.installations?.length ?? 0) > 0
  const hasGitLabCredentials = (gitlabCredentials?.length ?? 0) > 0

  // Reset selection when provider changes
  useEffect(() => {
    setSelectedInstallationId(null)
    setSelectedGitHubRepoId(null)
    setSelectedCredentialId(null)
    setSelectedGitLabProjectId(null)
    setOwner('')
    setRepoName('')
    setDefaultBranch('main')
    setManualEntry(false)
  }, [provider])

  // Reset repo selection when installation changes
  useEffect(() => {
    setSelectedGitHubRepoId(null)
    setOwner('')
    setRepoName('')
  }, [selectedInstallationId])

  // Reset project selection when credential changes
  useEffect(() => {
    setSelectedGitLabProjectId(null)
    setOwner('')
    setRepoName('')
  }, [selectedCredentialId])

  // Auto-refresh GitLab token if needed
  useEffect(() => {
    if (!selectedCredential?.needs_refresh || tokenRefreshingRef.current) return

    const doRefresh = async () => {
      if (!selectedCredential.instance_url) return
      tokenRefreshingRef.current = true
      setTokenRefreshing(true)
      try {
        await refreshGitLabToken(selectedCredential.instance_url)
        toast.success('GitLab token refreshed')
      } catch {
        toast.error('Failed to refresh GitLab token. Please refresh manually in Settings.')
      } finally {
        tokenRefreshingRef.current = false
        setTokenRefreshing(false)
      }
    }

    doRefresh()
  }, [selectedCredential?.needs_refresh, selectedCredential?.instance_url])

  const handleGitHubRepoSelect = (fullName: string, repoId: number) => {
    const parts = fullName.split('/')
    if (parts.length >= 2) {
      setOwner(parts[0])
      setRepoName(parts.slice(1).join('/'))
    }
    setSelectedGitHubRepoId(repoId)
    setDefaultBranch('main')
  }

  const handleGitLabProjectSelect = (pathWithNamespace: string, projectId: number) => {
    const parts = pathWithNamespace.split('/')
    if (parts.length >= 2) {
      setOwner(parts.slice(0, -1).join('/'))
      setRepoName(parts[parts.length - 1])
    }
    setSelectedGitLabProjectId(projectId)

    const project = gitlabProjects?.find(p => p.id === projectId)
    if (project?.default_branch) {
      setDefaultBranch(project.default_branch)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!owner || !repoName) {
      toast.error('Owner and repository name are required')
      return
    }

    setLoading(true)
    try {
      const repo = await createRepository({
        name: null,
        provider,
        owner,
        repo_name: repoName,
        clone_url: null,
        default_branch: defaultBranch || 'main',
        webhook_secret: webhookSecret || null,
        github_repository_id: selectedGitHubRepoId,
        github_installation_id: selectedInstallationId,
        gitlab_project_id: selectedGitLabProjectId,
      })
      toast.success('Repository created')
      router.push(`/repositories/${repo.id}`)
    } catch {
      toast.error('Failed to create repository')
    } finally {
      setLoading(false)
    }
  }

  const getInstallationLabel = (id: number) => {
    const inst = installations?.installations.find(i => i.installation_id === id)
    return inst ? `${inst.account_login} (${inst.account_type})` : ''
  }

  const getCredentialLabel = (id: string) => {
    const cred = gitlabCredentials?.find(c => c.id === id)
    if (!cred || !cred.instance_url) return ''
    try {
      const hostname = new URL(cred.instance_url).hostname
      return `${cred.username}@${hostname}`
    } catch {
      return `${cred.username}@${cred.instance_url}`
    }
  }

  const showManualEntryLink = hasIntegrations && !manualEntry && !setupLoading
  const showDropdownLink = manualEntry && hasIntegrations

  // Determine if we should show repository selector
  const showGitHubRepoSelector = provider === 'github' && !manualEntry && selectedInstallationId !== null
  const showGitLabProjectSelector = provider === 'gitlab' && !manualEntry && selectedCredentialId !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/repositories" />} aria-label="Back to repositories">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Repository</h1>
          <p className="text-muted-foreground text-sm">
            Connect a repository to start building
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-xl space-y-8">
        {/* Provider Selection */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Provider</legend>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProvider('github')}
              className={`flex items-center gap-3 p-4 border transition-colors ${
                provider === 'github'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <HugeiconsIcon icon={GithubIcon} className="size-5" />
              <span className="font-medium">GitHub</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider('gitlab')}
              className={`flex items-center gap-3 p-4 border transition-colors ${
                provider === 'gitlab'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <HugeiconsIcon icon={GitlabIcon} className="size-5" />
              <span className="font-medium">GitLab</span>
            </button>
          </div>
        </fieldset>

        {/* Repository Selection */}
        <fieldset className="space-y-4">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium">Repository</legend>
            {showManualEntryLink && (
              <button
                type="button"
                onClick={() => setManualEntry(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <HugeiconsIcon icon={Edit02Icon} className="size-3" />
                Enter manually
              </button>
            )}
            {showDropdownLink && (
              <button
                type="button"
                onClick={() => setManualEntry(false)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                Use dropdown
              </button>
            )}
          </div>

          {setupLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : manualEntry || !hasIntegrations ? (
            /* Manual Entry Mode */
            <div className="space-y-4">
              {!hasIntegrations && (
                <p className="text-sm text-muted-foreground">
                  No {provider === 'github' ? 'GitHub' : 'GitLab'} integration configured.{' '}
                  <Link
                    href={provider === 'github' ? '/settings/github' : '/settings/gitlab'}
                    className="text-primary hover:underline"
                  >
                    Set up in Settings
                  </Link>
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="owner" className="text-xs">Owner / Organization</Label>
                  <Input
                    id="owner"
                    placeholder="myorg…"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="repo-name" className="text-xs">Repository Name</Label>
                  <Input
                    id="repo-name"
                    placeholder="my-flutter-app…"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          ) : provider === 'github' ? (
            /* GitHub Dropdown Mode */
            <div className="space-y-3">
              {installationsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : !hasGitHubInstallations ? (
                <p className="text-sm text-muted-foreground">
                  No GitHub installations found.{' '}
                  <Link href="/settings/github" className="text-primary hover:underline">
                    Sync installations
                  </Link>
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="installation" className="text-xs">Account / Organization</Label>
                  <Select
                    value={selectedInstallationId?.toString() ?? ''}
                    onValueChange={(v) => setSelectedInstallationId(v ? Number(v) : null)}
                  >
                    <SelectTrigger id="installation" className="w-full">
                      <SelectValue placeholder="Select account">
                        {() => selectedInstallationId ? getInstallationLabel(selectedInstallationId) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {installations?.installations.map((inst) => (
                        <SelectItem key={inst.installation_id} value={inst.installation_id.toString()}>
                          {inst.account_login} ({inst.account_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showGitHubRepoSelector && (
                <div className="space-y-1.5">
                  <Label htmlFor="repository" className="text-xs">Repository</Label>
                  {reposLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : githubRepos?.repositories && githubRepos.repositories.length > 0 ? (
                    <Combobox
                      items={githubRepos.repositories}
                      itemToStringLabel={(repo) => repo.full_name}
                      itemToStringValue={(repo) => repo.full_name}
                      value={githubRepos.repositories.find(r => r.github_repository_id === selectedGitHubRepoId) ?? null}
                      onValueChange={(repo) => {
                        if (repo) {
                          handleGitHubRepoSelect(repo.full_name, repo.github_repository_id)
                        }
                      }}
                    >
                      <ComboboxInput
                        id="repository"
                        placeholder="Search repositories…"
                        showClear
                        className="w-full"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No repositories found</ComboboxEmpty>
                        <ComboboxList>
                          {(repo) => (
                            <ComboboxItem key={repo.github_repository_id} value={repo}>
                              <span className="flex-1 truncate">{repo.full_name}</span>
                              {repo.is_private && (
                                <HugeiconsIcon icon={LockIcon} className="size-3 text-muted-foreground" />
                              )}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      No repositories accessible.{' '}
                      <Link href="/settings/github" className="text-primary hover:underline">
                        Check permissions
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* GitLab Dropdown Mode */
            <div className="space-y-3">
              {credentialsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : !hasGitLabCredentials ? (
                <p className="text-sm text-muted-foreground">
                  No GitLab connections found.{' '}
                  <Link href="/settings/gitlab" className="text-primary hover:underline">
                    Connect GitLab
                  </Link>
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="credential" className="text-xs">GitLab Instance</Label>
                  <Select
                    value={selectedCredentialId ?? ''}
                    onValueChange={(v) => setSelectedCredentialId(v || null)}
                  >
                    <SelectTrigger id="credential" className="w-full">
                      <SelectValue placeholder="Select instance">
                        {() => selectedCredentialId ? getCredentialLabel(selectedCredentialId) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {gitlabCredentials?.filter((c) => c.instance_url).map((cred) => {
                        const hostname = (() => {
                          try {
                            return new URL(cred.instance_url!).hostname
                          } catch {
                            return cred.instance_url
                          }
                        })()
                        return (
                          <SelectItem key={cred.id} value={cred.id}>
                            {cred.username}@{hostname}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showGitLabProjectSelector && (
                <div className="space-y-1.5">
                  <Label htmlFor="project" className="text-xs">Project</Label>
                  {tokenRefreshing ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <HugeiconsIcon icon={RefreshIcon} className="size-4 animate-spin" />
                      Refreshing token…
                    </div>
                  ) : projectsLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : gitlabProjects && gitlabProjects.length > 0 ? (
                    <Combobox
                      items={gitlabProjects}
                      itemToStringLabel={(project) => project.path_with_namespace}
                      itemToStringValue={(project) => project.path_with_namespace}
                      value={gitlabProjects.find(p => p.id === selectedGitLabProjectId) ?? null}
                      onValueChange={(project) => {
                        if (project) {
                          handleGitLabProjectSelect(project.path_with_namespace, project.id)
                        }
                      }}
                    >
                      <ComboboxInput
                        id="project"
                        placeholder="Search projects…"
                        showClear
                        className="w-full"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No projects found</ComboboxEmpty>
                        <ComboboxList>
                          {(project) => (
                            <ComboboxItem key={project.id} value={project}>
                              {project.path_with_namespace}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      No projects found.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </fieldset>

        {/* Build Settings */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Build Settings</legend>

          <div className="space-y-1.5">
            <Label htmlFor="default-branch" className="text-xs">Default Branch</Label>
            <Input
              id="default-branch"
              placeholder="main…"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {provider === 'gitlab' && (
            <div className="space-y-1.5">
              <Label htmlFor="webhook-secret" className="text-xs">Webhook Secret</Label>
              <Input
                id="webhook-secret"
                type="password"
                placeholder="Enter a secret token…"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="max-w-xs"
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">
                Used to verify webhook payloads from GitLab
              </p>
            </div>
          )}
        </fieldset>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={loading || !owner || !repoName}>
            {loading ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                Create Repository
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
              </>
            )}
          </Button>
          <Button type="button" variant="ghost" nativeButton={false} render={<Link href="/repositories" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
