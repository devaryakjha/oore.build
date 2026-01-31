/** Equality function used by collection helpers. */
export type EqualityFn<T> = (a: T, b: T) => boolean

const defaultEquals: EqualityFn<unknown> = Object.is

/** Shallow compare two arrays using an optional element comparator. */
export function listEquals<T>(
  a: readonly T[] | null | undefined,
  b: readonly T[] | null | undefined,
  equals: EqualityFn<T> = defaultEquals as EqualityFn<T>
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i += 1) {
    if (!equals(a[i], b[i])) return false
  }

  return true
}
