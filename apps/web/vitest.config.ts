import { readFileSync } from 'node:fs'
import { URL, fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'oore-web-release-signature-fixture',
      enforce: 'pre',
      transform(code, id) {
        if (!id.replaceAll('\\', '/').endsWith('/tools/oore-web.js')) {
          return null
        }

        const childProcessImport =
          "import { spawn, spawnSync } from 'node:child_process'"
        if (!code.includes(childProcessImport)) {
          throw new Error('oore-web child-process import changed')
        }

        return code.replace(
          childProcessImport,
          `${"import { spawn, spawnSync as runChildProcessSync } from 'node:child_process'"}
const spawnSync = (command, args, options) => {
  let signature = ''
  try {
    const signatureIndex = args?.indexOf('-s') ?? -1
    if (signatureIndex >= 0) {
      signature = fs.readFileSync(args[signatureIndex + 1], 'utf8')
    }
  } catch {
    // Delegate malformed or unrelated calls to the real process.
  }
  if (
    args?.[0] === '-Y' &&
    args?.[1] === 'verify' &&
    (signature === 'index-signature' || signature === 'manifest-signature')
  ) {
    return { error: undefined, status: 0, stderr: '', stdout: '' }
  }
  return runChildProcessSync(command, args, options)
}`,
        )
      },
    },
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
