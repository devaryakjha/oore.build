'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Repository, Build, SetupStatus } from '@/lib/api/types'
import {
  FolderLibraryIcon,
  PackageIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface StatsCardsProps {
  repositories: Repository[] | undefined
  builds: Build[] | undefined
  setupStatus: SetupStatus | undefined
  isLoading: boolean
}

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: typeof FolderLibraryIcon
  isLoading: boolean
}

function StatCard({ title, value, description, icon, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-24 mt-1" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function StatsCards({ repositories, builds, setupStatus, isLoading }: StatsCardsProps) {
  const repoCount = repositories?.length ?? 0
  const activeRepos = repositories?.filter((r) => r.is_active).length ?? 0

  const buildCount = builds?.length ?? 0
  const successfulBuilds = builds?.filter((b) => b.status === 'success').length ?? 0
  const failedBuilds = builds?.filter((b) => b.status === 'failure').length ?? 0
  const runningBuilds = builds?.filter((b) => b.status === 'running' || b.status === 'pending').length ?? 0

  const integrationsConfigured =
    (setupStatus?.github.configured ? 1 : 0) + (setupStatus?.gitlab.length ?? 0)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Repositories"
        value={repoCount}
        description={`${activeRepos} active`}
        icon={FolderLibraryIcon}
        isLoading={isLoading}
      />
      <StatCard
        title="Total Builds"
        value={buildCount}
        description={runningBuilds > 0 ? `${runningBuilds} running` : 'No active builds'}
        icon={PackageIcon}
        isLoading={isLoading}
      />
      <StatCard
        title="Successful Builds"
        value={successfulBuilds}
        description={buildCount > 0 ? `${Math.round((successfulBuilds / buildCount) * 100)}% success rate` : 'No builds yet'}
        icon={CheckmarkCircle02Icon}
        isLoading={isLoading}
      />
      <StatCard
        title="Integrations"
        value={integrationsConfigured}
        description={`${failedBuilds} failed builds`}
        icon={AlertCircleIcon}
        isLoading={isLoading}
      />
    </div>
  )
}
