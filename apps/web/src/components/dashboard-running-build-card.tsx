import { Link } from '@tanstack/react-router'
import {
  ArrowRight as ArrowRightIcon,
  LoaderCircle as LoadingIcon,
} from 'lucide-react'

import RepositoryAvatar from '@/components/repository-avatar'
import type { Build } from '@/lib/types'
import { formatDuration } from '@/lib/format-utils'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function repositoryCommitUrl(build: Build): string | undefined {
  const sha = build.commit_sha
  const provider = build.context?.repository_provider
  const hostUrl = build.context?.repository_host_url
  const repository = build.context?.repository_full_name

  if (
    !sha ||
    !hostUrl ||
    !repository ||
    (provider !== 'github' && provider !== 'gitlab')
  ) {
    return undefined
  }

  try {
    const host = new URL(hostUrl)
    if (host.protocol !== 'https:' && host.protocol !== 'http:') {
      return undefined
    }
    const repositoryPath = repository
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    const commitPath = provider === 'gitlab' ? '-/commit' : 'commit'
    return new URL(
      `${repositoryPath}/${commitPath}/${encodeURIComponent(sha)}`,
      `${host.toString().replace(/\/+$/, '')}/`,
    ).toString()
  } catch {
    return undefined
  }
}

export default function DashboardRunningBuildCard({ build }: { build: Build }) {
  const projectName = build.context?.project_name ?? build.project_id
  const startedAt = build.started_at ?? build.created_at
  const runningFor = formatDuration(
    Math.max(0, Math.floor(Date.now() / 1000) - startedAt),
  )
  const commitUrl = repositoryCommitUrl(build)
  const commitLabel = build.commit_sha
    ? `#${build.commit_sha.slice(0, 8)}`
    : 'No commit'

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <RepositoryAvatar
            fullName={build.context?.repository_full_name ?? projectName}
            avatarUrl={build.context?.project_avatar_url}
          />
          <div className="min-w-0">
            <CardTitle>
              <Link
                to="/builds/$buildId"
                params={{ buildId: build.id }}
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {projectName}{' '}
                <span className="font-mono text-sm text-muted-foreground">
                  #{build.build_number}
                </span>
              </Link>
            </CardTitle>
            <CardDescription>
              {build.context?.pipeline_name ?? 'Build pipeline'}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">
            <LoadingIcon data-icon="inline-start" className="animate-spin" />
            Running
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <p
          className={cn(
            'line-clamp-2 min-h-10 text-sm leading-relaxed',
            !build.changelog && 'text-muted-foreground italic',
          )}
        >
          {build.changelog ?? 'No change summary was provided for this build.'}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Branch</dt>
            <dd className="truncate font-mono">{build.branch ?? 'n/a'}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Runner</dt>
            <dd className="truncate">
              {build.context?.runner_name ?? 'Assigning runner'}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Triggered by</dt>
            <dd className="truncate">{build.trigger_type}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Running for</dt>
            <dd className="font-mono tabular-nums">{runningFor}</dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-3">
        {commitUrl ? (
          <a
            href={commitUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Open commit ${commitLabel} in the source repository`}
          >
            {commitLabel}
          </a>
        ) : (
          <code className="text-xs text-muted-foreground">{commitLabel}</code>
        )}
        <Button
          variant="outline"
          render={<Link to="/builds/$buildId" params={{ buildId: build.id }} />}
          nativeButton={false}
        >
          Inspect build
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}
