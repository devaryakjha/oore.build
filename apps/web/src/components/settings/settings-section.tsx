import { useId } from 'react'

import { cn } from '@/lib/utils'

export function SettingsSurface({
  className,
  inset = true,
  ...props
}: React.ComponentProps<'div'> & { inset?: boolean }) {
  return (
    <div
      data-slot="settings-surface"
      className={cn(
        'overflow-hidden rounded-lg border bg-card text-card-foreground',
        inset && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    />
  )
}

export function SettingsSection({
  actions,
  children,
  className,
  description,
  title,
}: {
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
  description?: string
  title: string
}) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex min-w-0 flex-col gap-4', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="max-w-[65ch] text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children ?? null}
    </section>
  )
}
