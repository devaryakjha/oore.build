export interface Instance {
  id: string
  label: string
  url: string
  icon?: string
  addedAt: number
}

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonPrimitive | JsonObject | ReadonlyArray<JsonValue>

export interface JsonObject {
  [key: string]: JsonValue | undefined
}
