'use client'

import Link from 'next/link'
import { useRepositories, deleteRepository } from '@/lib/api/repositories'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDistanceToNow } from '@/lib/format'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Add01Icon,
  FolderLibraryIcon,
  MoreHorizontalIcon,
  ViewIcon,
  Delete01Icon,
  GithubIcon,
  GitlabIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function RepositoriesPage() {
  const { data: repositories, isLoading, mutate } = useRepositories()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      await deleteRepository(deleteId)
      toast.success('Repository deleted')
      mutate()
    } catch {
      toast.error('Failed to delete repository')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
          <p className="text-muted-foreground">
            Manage your connected repositories
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/repositories/new" />}>
          <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Repositories</CardTitle>
          <CardDescription>
            {repositories?.length ?? 0} repositories connected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : !repositories || repositories.length === 0 ? (
            <EmptyState
              icon={<HugeiconsIcon icon={FolderLibraryIcon} className="h-10 w-10" />}
              title="No repositories"
              description="Connect your first repository to start building."
              action={
                <Button nativeButton={false} render={<Link href="/repositories/new" />}>
                  <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                  Add Repository
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>
                      <Link
                        href={`/repositories/${repo.id}`}
                        className="font-medium hover:underline"
                      >
                        {repo.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {repo.owner}/{repo.repo_name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={repo.provider === 'github' ? GithubIcon : GitlabIcon}
                          className="h-4 w-4"
                        />
                        <span className="capitalize">{repo.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{repo.default_branch}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={repo.is_active ? 'default' : 'secondary'}>
                        {repo.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(repo.updated_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Repository actions" />}>
                          <HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem nativeButton={false} render={<Link href={`/repositories/${repo.id}`} />}>
                            <HugeiconsIcon icon={ViewIcon} className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(repo.id)}
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Repository"
        description="Are you sure you want to delete this repository? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
