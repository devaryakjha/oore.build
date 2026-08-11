import { readFileSync } from 'node:fs'
import { URL, fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'release-signing-key-text',
      enforce: 'pre',
      load(id) {
        const filePath = id.split('?', 1)[0]
        if (!filePath.endsWith('.pub')) return null

        return `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))}`
      },
    },
  ],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
