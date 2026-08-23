import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  ArrowLeft02Icon,
  Home01Icon,
  RotateClockwiseIcon,
} from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export function RootNotFound() {
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia>
          <span className="text-5xl font-bold tracking-tight text-muted-foreground/40">
            404
          </span>
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>
          The page you're looking for doesn't exist or has been moved.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link to="/" />} nativeButton={false}>
          <HugeiconsIcon icon={Home01Icon} />
          Overview
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={AlertCircleIcon} className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          An unexpected error occurred. Try refreshing or go back.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {import.meta.env.DEV && error instanceof Error ? (
          <Alert>
            <AlertDescription className="max-w-lg overflow-x-auto text-left font-mono text-xs">
              {error.message}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            <HugeiconsIcon icon={RotateClockwiseIcon} />
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <HugeiconsIcon icon={ArrowLeft02Icon} />
            Go back
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
