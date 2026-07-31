import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import mdx from 'fumadocs-mdx/vite'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const appDir = fileURLToPath(new URL('.', import.meta.url))
const docsDir = path.join(appDir, 'docs')

function authoredPagePaths(directory = docsDir): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return authoredPagePaths(filePath)
    if (!/\.(?:md|mdx)$/.test(entry.name)) return []

    const relativePath = path
      .relative(docsDir, filePath)
      .replace(/\.(?:md|mdx)$/, '')
      .replace(/(^|\/)index$/, '')

    return [`/${relativePath}`.replace(/\/$/, '') || '/']
  })
}

function openApiPagePaths(): string[] {
  const spec = JSON.parse(
    readFileSync(path.join(appDir, 'public/openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, { operationId?: string }>>
  }

  return Object.values(spec.paths).flatMap((pathItem) =>
    Object.values(pathItem).flatMap((operation) =>
      operation.operationId
        ? [`/openapi/operations/${operation.operationId}`]
        : [],
    ),
  )
}

const prerenderPages = [
  ...new Set([...authoredPagePaths(), ...openApiPagePaths(), '/api/search']),
].map((pagePath) => ({ path: pagePath }))

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    mdx(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          enabled: true,
          crawlLinks: false,
        },
      },
      prerender: {
        enabled: true,
        autoSubfolderIndex: false,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        failOnError: true,
      },
      pages: prerenderPages,
    }),
    react(),
    nitro({
      traceDeps: ['react', 'react-dom'],
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
})
