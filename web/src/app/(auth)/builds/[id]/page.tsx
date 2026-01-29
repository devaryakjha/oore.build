'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useBuild, cancelBuild } from '@/lib/api/builds'
import { useRepository } from '@/lib/api/repositories'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { BuildStatusBadge } from '@/components/builds/build-status'
import { BuildLogsSection } from '@/components/builds/build-logs-section'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateTime, formatDistanceToNow, calculateDuration } from '@/lib/format'
import { toast } from 'sonner'
import {
  ArrowLeft02Icon,
  Cancel01Icon,
  GitBranchIcon,
  GitCommitIcon,
  Clock01Icon,
  PlayIcon,
  StopIcon,
  FolderLibraryIcon,
  GitPullRequestIcon,
  Settings01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function BuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const shouldPoll = true // Always poll for now
  const { data: build, isLoading, mutate } = useBuild(id, shouldPoll)
  const { data: repo } = useRepository(build?.repository_id ?? null)

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const canCancel = build?.status === 'pending' || build?.status === 'running'

  const handleCancel = async () => {
    if (!build) return

    setCancelling(true)
    try {
      await cancelBuild(build.id)
      toast.success('Build cancelled')
      mutate()
    } catch {
      toast.error('Failed to cancel build')
    } finally {
      setCancelling(false)
      setShowCancelDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/builds" />} aria-label="Back to builds">
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

  if (!build) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/builds" />} aria-label="Back to builds">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
        </div>
        <EmptyState
          title="Build not found"
          description="The build you're looking for doesn't exist or has been deleted."
          action={
            <Button nativeButton={false} render={<Link href="/builds" />}>
              Back to Builds
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/builds" />} aria-label="Back to builds">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Build #{build.id.slice(-6)}
              </h1>
              <BuildStatusBadge status={build.status} />
            </div>
            <p className="text-muted-foreground">
              {repo?.name ?? 'Unknown Repository'}
            </p>
          </div>
        </div>
        {canCancel && (
          <Button
            variant="destructive"
            onClick={() => setShowCancelDialog(true)}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="mr-2 h-4 w-4" />
            Cancel Build
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Build Details</CardTitle>
            <CardDescription>Build information and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HugeiconsIcon icon={GitBranchIcon} className="h-4 w-4" />
                  Branch
                </span>
                <code className="font-mono">{build.branch}</code>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HugeiconsIcon icon={GitCommitIcon} className="h-4 w-4" />
                  Commit
                </span>
                <code className="font-mono">{build.commit_sha}</code>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Trigger</span>
                <span className="capitalize">{build.trigger_type.replace('_', ' ')}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HugeiconsIcon icon={FolderLibraryIcon} className="h-4 w-4" />
                  Repository
                </span>
                {repo ? (
                  <Link
                    href={`/repositories/${repo.id}`}
                    className="text-primary hover:underline"
                  >
                    {repo.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Unknown</span>
                )}
              </div>
              {build.webhook_event_id && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <HugeiconsIcon icon={GitPullRequestIcon} className="h-4 w-4" />
                      Webhook Event
                    </span>
                    <code className="font-mono text-xs">
                      {build.webhook_event_id.slice(-8)}
                    </code>
                  </div>
                </>
              )}
              {build.workflow_name && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <HugeiconsIcon icon={Settings01Icon} className="h-4 w-4" />
                      Workflow
                    </span>
                    <span className="font-medium">{build.workflow_name}</span>
                  </div>
                </>
              )}
              {build.config_source && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Config Source</span>
                    <Badge variant="secondary" className="capitalize">
                      {build.config_source}
                    </Badge>
                  </div>
                </>
              )}
              {build.error_message && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 text-destructive" />
                      Error
                    </span>
                    <code className="font-mono text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {build.error_message}
                    </code>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timing</CardTitle>
            <CardDescription>Build timeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4" />
                  Created
                </span>
                <div className="text-right">
                  <div>{formatDateTime(build.created_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(build.created_at)}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HugeiconsIcon icon={PlayIcon} className="h-4 w-4" />
                  Started
                </span>
                {build.started_at ? (
                  <div className="text-right">
                    <div>{formatDateTime(build.started_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(build.started_at)}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not started</span>
                )}
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HugeiconsIcon icon={StopIcon} className="h-4 w-4" />
                  Finished
                </span>
                {build.finished_at ? (
                  <div className="text-right">
                    <div>{formatDateTime(build.finished_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(build.finished_at)}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    {build.status === 'running' ? 'In progress…' : 'Not finished'}
                  </span>
                )}
              </div>
              {build.started_at && build.finished_at && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                      {calculateDuration(build.started_at, build.finished_at)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <BuildLogsSection buildId={id} buildStatus={build.status} />

      <ConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Build"
        description="Are you sure you want to cancel this build? This action cannot be undone."
        confirmText="Cancel Build"
        variant="destructive"
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </div>
  )
}
