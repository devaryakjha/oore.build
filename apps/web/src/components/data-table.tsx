import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function DataTableFrame({
  children,
  className,
  footer,
  fill = footer != null,
}: {
  children: ReactNode
  className?: string
  footer?: ReactNode
  fill?: boolean
}) {
  return (
    <div
      data-slot="data-table"
      className={cn(
        'flex min-w-0 flex-col',
        fill && 'min-h-0 flex-1',
        className,
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded-md border',
          fill && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        <div
          data-slot="data-table-viewport"
          className={cn(
            'min-w-0 scrollbar-gutter-stable overflow-auto overscroll-contain',
            fill ? 'min-h-72 flex-1' : 'max-h-[clamp(18rem,58dvh,48rem)]',
            '**:data-[slot=table-container]:overflow-visible',
            '**:data-[slot=table-header]:sticky **:data-[slot=table-header]:top-0 **:data-[slot=table-header]:z-10',
            '**:data-[slot=table-head]:bg-background',
          )}
        >
          {children}
        </div>
      </div>
      {footer ? (
        <div data-slot="data-table-footer" className="shrink-0 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
