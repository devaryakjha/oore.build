'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BuildStatusBadge } from '@/components/builds/build-status'
import { EmptyState } from '@/components/shared/empty-state'
import type { Build } from '@/lib/api/types'
import { formatDistanceToNow } from '@/lib/format'
import {
  ArrowRight01Icon,
  PackageIcon,
  GitBranchIcon,
  GitCommitIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface RecentBuildsProps {
  builds: Build[] | undefined
  isLoading: boolean
}

export function RecentBuilds({ builds, isLoading }: RecentBuildsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Builds</CardTitle>
          <CardDescription>Latest build activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Builds</CardTitle>
          <CardDescription>Latest build activity</CardDescription>
        </div>
        <Button nativeButton={false} render={<Link href="/builds" />} variant="outline" size="sm">
          View all
          <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        {!builds || builds.length === 0 ? (
          <EmptyState
            icon={<HugeiconsIcon icon={PackageIcon} className="h-10 w-10" />}
            title="No builds yet"
            description="Builds will appear here once you trigger them or receive webhook events."
          />
        ) : (
          <div className="space-y-4">
            {builds.map((build) => (
              <Link
                key={build.id}
                href={`/builds/${build.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BuildStatusBadge status={build.status} showLabel={false} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <HugeiconsIcon icon={GitBranchIcon} className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium truncate">{build.branch}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={GitCommitIcon} className="h-3 w-3" />
                      <span className="font-mono">{build.commit_sha.slice(0, 7)}</span>
                      <span className="capitalize">{build.trigger_type.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(build.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
