'use client'

import Link from 'next/link'
import { useWebhookEvents } from '@/lib/api/webhooks'
import { useRepositories } from '@/lib/api/repositories'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { formatDistanceToNow } from '@/lib/format'
import {
  GitPullRequestIcon,
  GithubIcon,
  GitlabIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function WebhooksPage() {
  const { data: webhooks, isLoading } = useWebhookEvents()
  const { data: repositories } = useRepositories()

  const sortedWebhooks = webhooks
    ?.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
    ?? []

  const getRepoName = (repoId: string | undefined) => {
    if (!repoId) return 'Unknown'
    const repo = repositories?.find((r) => r.id === repoId)
    return repo?.name ?? 'Unknown'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground">
          View incoming webhook events
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Events</CardTitle>
          <CardDescription>
            {sortedWebhooks.length} events received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} />
          ) : sortedWebhooks.length === 0 ? (
            <EmptyState
              icon={<HugeiconsIcon icon={GitPullRequestIcon} className="h-10 w-10" />}
              title="No webhook events"
              description="Webhook events will appear here when your repositories receive pushes or pull requests."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Delivery ID</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedWebhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      {webhook.processed ? (
                        webhook.error_message ? (
                          <Badge variant="destructive" className="gap-1">
                            <HugeiconsIcon icon={AlertCircleIcon} className="h-3 w-3" />
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                            Processed
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={webhook.provider === 'github' ? GithubIcon : GitlabIcon}
                          className="h-4 w-4"
                        />
                        <span className="capitalize">{webhook.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{webhook.event_type}</code>
                    </TableCell>
                    <TableCell>
                      {webhook.repository_id ? (
                        <Link
                          href={`/repositories/${webhook.repository_id}`}
                          className="hover:underline"
                        >
                          {getRepoName(webhook.repository_id)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono text-muted-foreground">
                        {webhook.delivery_id.slice(0, 16)}…
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(webhook.received_at)}
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
