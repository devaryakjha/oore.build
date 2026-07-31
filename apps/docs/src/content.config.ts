import { glob } from 'astro/loaders'
import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z
      .enum(['implemented', 'placeholder', 'preview', 'removed'])
      .optional(),
  }),
})

const meta = defineCollection({
  loader: glob({ pattern: '**/*.{json,yaml}', base: './content/docs' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    pages: z.array(z.string()).optional(),
    pagesIndex: z.string().optional(),
    root: z.boolean().optional(),
  }),
})

export const collections = {
  docs,
  meta,
}
