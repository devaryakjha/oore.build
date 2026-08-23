import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
  divided?: boolean
}

export default function PageHeader({
  title,
  description,
  actions,
  meta,
  divided = false,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', divided && 'border-b pb-5')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="max-w-[65ch] text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {meta ? (
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </header>
  )
}
