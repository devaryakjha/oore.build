'use client'

import { useSetupStatus } from '@/lib/api/setup'
import { useRepositories } from '@/lib/api/repositories'
import { useRecentBuilds } from '@/lib/api/builds'
import { SetupStatusCard } from '@/components/dashboard/setup-status'
import { RecentBuilds } from '@/components/dashboard/recent-builds'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { StatsCards } from '@/components/dashboard/stats-cards'

export default function DashboardPage() {
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { data: repositories, isLoading: reposLoading } = useRepositories()
  const { data: recentBuilds, isLoading: buildsLoading } = useRecentBuilds(5)

  const isLoading = setupLoading || reposLoading || buildsLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your CI/CD platform
        </p>
      </div>

      <StatsCards
        repositories={repositories}
        builds={recentBuilds}
        setupStatus={setupStatus}
        isLoading={isLoading}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SetupStatusCard status={setupStatus} isLoading={setupLoading} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      <RecentBuilds builds={recentBuilds} isLoading={buildsLoading} />
    </div>
  )
}
