import { cn } from '@/lib/utils'
import { cssProperties } from '@/lib/css-properties'

function AspectRatio({
  ratio,
  className,
  ...props
}: React.ComponentProps<'div'> & { ratio: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      style={cssProperties({ '--ratio': ratio })}
      className={cn('relative aspect-(--ratio)', className)}
      {...props}
    />
  )
}

export { AspectRatio }
