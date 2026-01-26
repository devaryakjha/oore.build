/** Equality function used by collection helpers. */
export type EqualityFn<T> = (a: T, b: T) => boolean

const defaultEquals: EqualityFn<unknown> = Object.is
const toString = Object.prototype.toString

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

/** Shallow compare two maps by key presence and value comparator. */
export function mapEquals<K, V>(
  a: ReadonlyMap<K, V> | null | undefined,
  b: ReadonlyMap<K, V> | null | undefined,
  valueEquals: EqualityFn<V> = defaultEquals as EqualityFn<V>
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.size !== b.size) return false

  for (const [key, value] of a) {
    if (!b.has(key)) return false
    if (!valueEquals(value, b.get(key)!)) return false
  }

  return true
}

/** Shallow compare two sets by membership. */
export function setEquals<T>(
  a: ReadonlySet<T> | null | undefined,
  b: ReadonlySet<T> | null | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.size !== b.size) return false

  for (const value of a) {
    if (!b.has(value)) return false
  }

  return true
}

function arrayBufferEquals(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false
  const aView = new Uint8Array(a)
  const bView = new Uint8Array(b)
  for (let i = 0; i < aView.length; i += 1) {
    if (aView[i] !== bView[i]) return false
  }
  return true
}

function setDeepEquals<T>(
  a: ReadonlySet<T>,
  b: ReadonlySet<T>,
  seen: WeakMap<object, object>
): boolean {
  if (a.size !== b.size) return false
  const remaining = new Set(b)

  outer: for (const aValue of a) {
    for (const bValue of remaining) {
      if (deepEqualsInternal(aValue, bValue, seen)) {
        remaining.delete(bValue)
        continue outer
      }
    }
    return false
  }

  return true
}

/**
 * Deep structural equality with cycle detection.
 *
 * Supports: primitives, arrays, plain objects, Map (by key identity),
 * Set (by deep element equality), Date, RegExp, ArrayBuffer, typed arrays.
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  return deepEqualsInternal(a, b, new WeakMap())
}

function deepEqualsInternal(
  a: unknown,
  b: unknown,
  seen: WeakMap<object, object>
): boolean {
  if (Object.is(a, b)) return true
  if (a == null || b == null) return false
  if (typeof a !== "object" || typeof b !== "object") return false

  if (seen.get(a) === b) return true
  seen.set(a as object, b as object)

  const aTag = toString.call(a)
  const bTag = toString.call(b)
  if (aTag !== bTag) return false

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags
  }

  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.byteLength !== b.byteLength) return false
    return arrayBufferEquals(a.buffer as ArrayBuffer, b.buffer as ArrayBuffer)
  }

  if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
    return arrayBufferEquals(a, b)
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqualsInternal(a[i], b[i], seen)) return false
    }
    return true
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false
    for (const [key, value] of a) {
      if (!b.has(key)) return false
      if (!deepEqualsInternal(value, b.get(key), seen)) return false
    }
    return true
  }

  if (a instanceof Set && b instanceof Set) {
    return setDeepEquals(a, b, seen)
  }

  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false

  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    const aValue = (a as Record<string, unknown>)[key]
    const bValue = (b as Record<string, unknown>)[key]
    if (!deepEqualsInternal(aValue, bValue, seen)) return false
  }

  return true
}
