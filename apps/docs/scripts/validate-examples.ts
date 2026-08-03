import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const appDir = path.resolve(import.meta.dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const docsDir = path.join(appDir, 'content/docs')

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory()
      ? walk(file)
      : /\.(?:md|mdx)$/.test(file)
        ? [file]
        : []
  })
}

function codeFences(source: string) {
  return [
    ...source.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm),
  ].map((match) => ({
    info: match[2].trim().split(/\s+/, 1)[0].toLowerCase(),
    source: match[3],
  }))
}

function logicalShellLines(source: string) {
  const lines: string[] = []
  let current = ''
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    current = current ? `${current} ${line}` : line
    if (current.endsWith('\\')) {
      current = current.slice(0, -1).trimEnd()
      continue
    }
    lines.push(current)
    current = ''
  }
  if (current) lines.push(current)
  return lines
}

function shellWords(source: string) {
  const words: string[] = []
  let current = ''
  let quote: "'" | '"' | undefined
  let escaped = false

  for (const character of source) {
    if (escaped) {
      current += character
      escaped = false
    } else if (character === '\\' && quote !== "'") {
      escaped = true
    } else if (quote) {
      if (character === quote) quote = undefined
      else current += character
    } else if (character === "'" || character === '"') {
      quote = character
    } else if (/\s/.test(character)) {
      if (current) words.push(current)
      current = ''
    } else {
      current += character
    }
  }
  if (quote || escaped) throw new Error(`Unclosed shell token: ${source}`)
  if (current) words.push(current)
  return words
}

function executableCommand(line: string) {
  const command = line
    .replace(/^(?:[A-Z_][A-Z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s+)*/, '')
    .replace(/^sudo\s+/, '')
    .replace(/^\.\/target\/release\//, '')
    .replace(/^~\/\.oore\/bin\//, '')
  if (!/^oore(?:d)?(?:\s|$)/.test(command)) return
  return command.split(/\s+(?:\|\||&&|\||;|>|>>|2>)/, 1)[0]
}

execFileSync(
  'cargo',
  ['build', '-p', 'oore', '-p', 'oored', '--bins', '--locked'],
  {
    cwd: repoDir,
    stdio: 'inherit',
  },
)

const binaries = {
  oore: path.join(repoDir, 'target/debug/oore'),
  oored: path.join(repoDir, 'target/debug/oored'),
}
const helpCache = new Map<string, string>()
const commandCases: string[] = []
const yamlCases: Array<{ file: string; source: string }> = []

for (const file of walk(docsDir)) {
  const relative = path.relative(docsDir, file).split(path.sep).join('/')
  for (const fence of codeFences(fs.readFileSync(file, 'utf8'))) {
    if (['bash', 'console', 'sh', 'shell', 'zsh'].includes(fence.info)) {
      for (const line of logicalShellLines(fence.source)) {
        const command = executableCommand(line)
        if (command) commandCases.push(`${relative}: ${command}`)
      }
    }

    if (['yaml', 'yml'].includes(fence.info)) {
      const topLevelVersion = /^version:\s*1\s*$/m.test(fence.source)
      const topLevelPlatforms = /^platforms:\s*$/m.test(fence.source)
      if (topLevelVersion && topLevelPlatforms) {
        yamlCases.push({ file: relative, source: fence.source })
      }
    }
  }
}

if (commandCases.length === 0) throw new Error('No public CLI examples found')
if (yamlCases.length === 0)
  throw new Error('No complete .oore.yaml examples found')

for (const owner of commandCases) {
  const command = owner.slice(owner.indexOf(': ') + 2)
  const tokens = shellWords(command)
  const executable = tokens.shift()
  if (executable !== 'oore' && executable !== 'oored') {
    throw new Error(`Unexpected public executable: ${owner}`)
  }

  const synopsis = /[[\]<>]|\bOPTIONS\b|\bCOMMAND\b/.test(command)
  const flags = [...command.matchAll(/--[a-z][a-z0-9-]*/g)].map(
    (match) => match[0],
  )
  const commandPath: string[] = []
  for (const token of tokens) {
    if (token.startsWith('-') || /[[\]<>]/.test(token)) break
    commandPath.push(token)
    if (commandPath.length === 3) break
  }

  const helpKey = [executable, ...commandPath].join(' ')
  let help = helpCache.get(helpKey)
  if (!help) {
    const result = spawnSync(binaries[executable], [...commandPath, '--help'], {
      cwd: repoDir,
      encoding: 'utf8',
    })
    if (result.status !== 0) {
      throw new Error(
        `${owner}\nCurrent help rejected the command path:\n${result.stderr}`,
      )
    }
    help = `${result.stdout}\n${result.stderr}`
    helpCache.set(helpKey, help)
  }
  for (const flag of flags) {
    if (!help.includes(flag)) {
      throw new Error(`${owner}\nCurrent help does not contain ${flag}`)
    }
  }

  if (!synopsis) {
    const result = spawnSync(binaries[executable], [...tokens, '--help'], {
      cwd: repoDir,
      encoding: 'utf8',
    })
    if (result.status !== 0) {
      throw new Error(
        `${owner}\nCurrent CLI rejected the documented invocation:\n${result.stderr}`,
      )
    }
  }
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'oore-docs-yaml-'))
try {
  yamlCases.forEach((example, index) => {
    const file = path.join(temporary, `${index}.oore.yaml`)
    fs.writeFileSync(file, example.source)
    const result = spawnSync(binaries.oore, ['pipeline', 'validate', file], {
      cwd: repoDir,
      encoding: 'utf8',
    })
    if (result.status !== 0) {
      throw new Error(
        `${example.file} contains an invalid .oore.yaml example:\n${result.stderr}`,
      )
    }
  })
} finally {
  fs.rmSync(temporary, { force: true, recursive: true })
}

console.log(
  JSON.stringify({
    cliExamples: commandCases.length,
    helpSurfaces: helpCache.size,
    pipelineExamples: yamlCases.length,
    result: 'PASS',
  }),
)
