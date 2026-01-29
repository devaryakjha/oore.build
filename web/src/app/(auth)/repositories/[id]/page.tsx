'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRepository, useWebhookUrl, deleteRepository } from '@/lib/api/repositories'
import { useBuilds, triggerBuild } from '@/lib/api/builds'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { BuildStatusBadge } from '@/components/builds/build-status'
import { PipelineConfigCard } from '@/components/pipelines/pipeline-config-card'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDistanceToNow, formatDateTime } from '@/lib/format'
import { validateGitUrl, validateExternalUrl } from '@/lib/url'
import { toast } from 'sonner'
import {
  ArrowLeft02Icon,
  Delete01Icon,
  PlayIcon,
  Copy01Icon,
  GithubIcon,
  GitlabIcon,
  PackageIcon,
  GitBranchIcon,
  GitCommitIcon,
  LinkSquare01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: repo, isLoading: repoLoading } = useRepository(id)
  const { data: webhookUrl, isLoading: webhookLoading } = useWebhookUrl(id)
  const { data: builds, isLoading: buildsLoading } = useBuilds(id)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const handleCopyWebhookUrl = () => {
    if (webhookUrl?.webhook_url) {
      navigator.clipboard.writeText(webhookUrl.webhook_url)
      toast.success('Webhook URL copied to clipboard')
    }
  }

  const handleTriggerBuild = async () => {
    if (!repo) return

    setTriggering(true)
    try {
      const build = await triggerBuild(repo.id)
      toast.success('Build triggered')
      router.push(`/builds/${build.id}`)
    } catch {
      toast.error('Failed to trigger build')
    } finally {
      setTriggering(false)
    }
  }

  const handleDelete = async () => {
    if (!repo) return

    setDeleting(true)
    try {
      await deleteRepository(repo.id)
      toast.success('Repository deleted')
      router.push('/repositories')
    } catch {
      toast.error('Failed to delete repository')
    } finally {
      setDeleting(false)
    }
  }

  if (repoLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/repositories" />} aria-label="Back to repositories">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/repositories" />} aria-label="Back to repositories">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
        </div>
        <EmptyState
          title="Repository not found"
          description="The repository you're looking for doesn't exist or has been deleted."
          action={
            <Button nativeButton={false} render={<Link href="/repositories" />}>
              Back to Repositories
            </Button>
          }
        />
      </div>
    )
  }

  const repoBuilds = builds?.slice(0, 10) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/repositories" />} aria-label="Back to repositories">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={repo.provider === 'github' ? GithubIcon : GitlabIcon}
                className="h-5 w-5"
              />
              <h1 className="text-2xl font-bold tracking-tight">{repo.name}</h1>
              <Badge variant={repo.is_active ? 'default' : 'secondary'}>
                {repo.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {repo.owner}/{repo.repo_name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleTriggerBuild} disabled={triggering}>
            <HugeiconsIcon icon={PlayIcon} className="mr-2 h-4 w-4" />
            {triggering ? 'Triggering…' : 'Trigger Build'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repository Details</CardTitle>
            <CardDescription>Configuration and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="capitalize font-medium">{repo.provider}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Default Branch</span>
                <code className="font-mono">{repo.default_branch}</code>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clone URL</span>
                {validateGitUrl(repo.clone_url) ? (
                  <a
                    href={validateGitUrl(repo.clone_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate max-w-[200px]"
                  >
                    {repo.clone_url}
                  </a>
                ) : (
                  <span className="truncate max-w-[200px]">{repo.clone_url}</span>
                )}
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(repo.created_at)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDistanceToNow(repo.updated_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              {repo.provider === 'github'
                ? 'Webhooks managed by GitHub App'
                : 'Configure GitLab project webhook'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {repo.provider === 'github' ? (
              // GitHub: Webhooks are configured at the App level, not per-repo
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-muted/50 border rounded-md">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Webhooks are automatic</p>
                    <p className="text-sm text-muted-foreground">
                      Your GitHub App handles webhook delivery for all repositories. No manual configuration needed.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-md">
                  <HugeiconsIcon icon={InformationCircleIcon} className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Push events, pull requests, and installation changes are delivered automatically to your Oore server.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={<Link href="/settings/github" />}
                >
                  <HugeiconsIcon icon={GithubIcon} className="mr-2 h-4 w-4" />
                  View GitHub App Settings
                </Button>
              </div>
            ) : webhookLoading ? (
              <div className="h-20 bg-muted animate-pulse rounded" />
            ) : (
              // GitLab: Per-project webhooks
              <>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook-url"
                      value={webhookUrl?.webhook_url || ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyWebhookUrl}
                      aria-label="Copy webhook URL"
                    >
                      <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Copy this URL and add it to your GitLab project&apos;s webhook settings, or use the CLI command <code className="text-xs bg-muted px-1 py-0.5 rounded">oore gitlab enable</code> to configure it automatically.
                </p>
                {validateExternalUrl(repo.clone_url.replace('.git', '/-/hooks')) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    nativeButton={false}
                    render={<a href={validateExternalUrl(repo.clone_url.replace('.git', '/-/hooks'))!} target="_blank" rel="noopener noreferrer" />}
                  >
                    <HugeiconsIcon icon={LinkSquare01Icon} className="mr-2 h-4 w-4" />
                    Open Webhook Settings
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <PipelineConfigCard repositoryId={id} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Builds</CardTitle>
          <CardDescription>Build history for this repository</CardDescription>
        </CardHeader>
        <CardContent>
          {buildsLoading ? (
            <TableSkeleton rows={5} />
          ) : repoBuilds.length === 0 ? (
            <EmptyState
              icon={<HugeiconsIcon icon={PackageIcon} className="h-10 w-10" />}
              title="No builds yet"
              description="Trigger a build or push to your repository to start building."
              action={
                <Button onClick={handleTriggerBuild} disabled={triggering}>
                  <HugeiconsIcon icon={PlayIcon} className="mr-2 h-4 w-4" />
                  Trigger Build
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {repoBuilds.map((build) => (
                <Link
                  key={build.id}
                  href={`/builds/${build.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BuildStatusBadge status={build.status} showLabel={false} />
                    <div>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={GitBranchIcon} className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{build.branch}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <HugeiconsIcon icon={GitCommitIcon} className="h-3 w-3" />
                        <code>{build.commit_sha.slice(0, 7)}</code>
                        <span className="capitalize">{build.trigger_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(build.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Repository"
        description="Are you sure you want to delete this repository? This action cannot be undone and all build history will be lost."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
