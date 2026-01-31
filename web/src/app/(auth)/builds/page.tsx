'use client'

import Link from 'next/link'
import { useBuilds } from '@/lib/api/builds'
import { useRepositories } from '@/lib/api/repositories'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BuildStatusBadge } from '@/components/builds/build-status'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { formatDistanceToNow } from '@/lib/format'
import type { BuildStatus } from '@/lib/api/types'
import { useState } from 'react'
import {
  PackageIcon,
  GitBranchIcon,
  GitCommitIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function BuildsPage() {
  const [selectedRepo, setSelectedRepo] = useState<string>('all')
  const { data: repositories } = useRepositories()
  const { data: builds, isLoading } = useBuilds(
    selectedRepo === 'all' ? undefined : selectedRepo
  )

  const sortedBuilds = builds
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    ?? []

  const getRepoName = (repoId: string) => {
    const repo = repositories?.find((r) => r.id === repoId)
    return repo?.name ?? 'Unknown'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Builds</h1>
          <p className="text-muted-foreground">
            View and manage all builds
          </p>
        </div>
        <Select value={selectedRepo} onValueChange={(value) => value && setSelectedRepo(value)}>
          <SelectTrigger className="w-[200px]" aria-label="Filter by repository">
            <SelectValue placeholder="Filter by repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Repositories</SelectItem>
            {repositories?.map((repo) => (
              <SelectItem key={repo.id} value={repo.id}>
                {repo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Build History</CardTitle>
          <CardDescription>
            {sortedBuilds.length} builds total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} />
          ) : sortedBuilds.length === 0 ? (
            <EmptyState
              icon={<HugeiconsIcon icon={PackageIcon} className="h-10 w-10" />}
              title="No builds yet"
              description="Builds will appear here when you trigger them or receive webhook events."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBuilds.map((build) => (
                  <TableRow key={build.id}>
                    <TableCell>
                      <Link href={`/builds/${build.id}`}>
                        <BuildStatusBadge status={build.status as BuildStatus} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/repositories/${build.repository_id}`}
                        className="hover:underline"
                      >
                        {getRepoName(build.repository_id)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <HugeiconsIcon icon={GitBranchIcon} className="h-3 w-3 text-muted-foreground" />
                        <code className="text-sm">{build.branch}</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <HugeiconsIcon icon={GitCommitIcon} className="h-3 w-3 text-muted-foreground" />
                        <code className="text-sm font-mono">{build.commit_sha.slice(0, 7)}</code>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {build.trigger_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(build.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
