import * as z from 'zod'
import type { JsonObject } from '@/lib/types'

const jsonObjectSchema = z.record(z.string(), z.json())

export async function parseDemoJsonObject(
  request: Request,
): Promise<JsonObject> {
  return jsonObjectSchema.parse(await request.json())
}
