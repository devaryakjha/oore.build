import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'

export function Icon({
  icon,
  className,
}: {
  icon: IconSvgElement
  className?: string
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      aria-hidden="true"
      strokeWidth={1.8}
    />
  )
}
