import type { CSSProperties } from 'react'

type CustomProperties = Partial<
  Record<`--${string}`, number | string | undefined>
>

export function cssProperties<T extends CSSProperties & CustomProperties>(
  value: T,
): CSSProperties {
  return value
}
