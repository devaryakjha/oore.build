import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'

import { Badge } from '@/components/ui/badge'
import { CardDescription, CardTitle } from '@/components/ui/card'

export function PipelineFormSectionHeader({
  title,
  summary,
  errorCount,
}: {
  title: string
  summary?: string
  errorCount?: number
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <CardTitle>{title}</CardTitle>
        {errorCount && errorCount > 0 ? (
          <Badge variant="destructive" className="text-[10px]">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {summary ? (
          <CardDescription className="text-xs in-data-[open]:hidden">
            {summary}
          </CardDescription>
        ) : null}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          className="text-muted-foreground transition-transform in-data-[open]:rotate-180"
        />
      </div>
    </div>
  )
}
