import fs from 'node:fs'

export type SourceTerminal = {
  disposition: string
  id: string
  response: 200 | 301 | 404
  source: string
  terminal?: string
}

export type RedirectRule = {
  source: string
  status: 301
  target: string
}

export type EditorialPage = {
  id: string
  path: string
  title: string
  type: 'concept' | 'landing' | 'reference' | 'task' | 'tutorial'
}

export type CanonicalNavigationItem =
  | {
      kind: 'folder'
      label: string
      pages: EditorialPage[]
    }
  | {
      kind: 'page'
      page: EditorialPage
    }

export type CanonicalNavigationSection = {
  items: CanonicalNavigationItem[]
  label: string
}

export type OpenAPINavigationGroup = {
  label: string
  tag: string
}

export type OpenAPICategoryGroup = {
  label: string
  tags: string[]
}

export function contentRoute(relativeFile: string) {
  const segments = relativeFile
    .split(/[\\/]/)
    .filter((segment) => !/^\(.+\)$/.test(segment))
  const file = segments.pop()
  if (!file) throw new Error(`Content path has no file: ${relativeFile}`)
  const name = file.replace(/\.(?:md|mdx)$/, '')
  if (name === file) {
    throw new Error(`Content path is not Markdown or MDX: ${relativeFile}`)
  }
  if (name !== 'index') segments.push(name)
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

function markedBlock(source: string, marker: string) {
  const match = source.match(
    new RegExp(
      `<!-- ${marker}_BEGIN -->[\\s\\S]*?\`\`\`text\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\`[\\s\\S]*?<!-- ${marker}_END -->`,
    ),
  )
  if (!match) throw new Error(`Missing ${marker} registry`)
  return match[1]
}

function uniqueRows<T>(rows: T[], key: (row: T) => string, registry: string) {
  const seen = new Set<string>()
  for (const row of rows) {
    const value = key(row)
    if (seen.has(value)) {
      throw new Error(`${registry} contains duplicate ${value}`)
    }
    seen.add(value)
  }
  return rows
}

export function readUrlContract(path: string) {
  return fs.readFileSync(path, 'utf8')
}

export function authoredCanonicals(contract: string) {
  const lines = markedBlock(contract, 'AUTHORED_CANONICALS')
    .split(/\r?\n/)
    .filter(Boolean)
  const rows = lines.map((line) => {
    const match = line.match(/^(P\d{3}) \| (\/\S*)$/)
    if (!match) throw new Error(`Malformed authored canonical row: ${line}`)
    return { id: match[1], path: match[2] }
  })
  uniqueRows(rows, (row) => row.id, 'Authored canonical registry IDs')
  uniqueRows(rows, (row) => row.path, 'Authored canonical registry paths')
  return rows
}

function editorialPage(line: string): EditorialPage | undefined {
  const match = line.match(
    /^\| (P\d{3}) \| (.*?) \| `(\/[^`]*)`\s+\| (concept|landing|reference|task|tutorial)\s+\|/,
  )
  if (!match) return
  return {
    id: match[1],
    path: match[3],
    title: match[2].trim(),
    type: match[4] as EditorialPage['type'],
  }
}

export function editorialPages(tree: string) {
  const rows = tree
    .split(/\r?\n/)
    .flatMap((line) => (editorialPage(line) ? [editorialPage(line)!] : []))

  uniqueRows(rows, (row) => row.id, 'Editorial page IDs')
  uniqueRows(rows, (row) => row.path, 'Editorial page paths')
  uniqueRows(rows, (row) => row.title, 'Editorial page titles')
  if (rows.length === 0) throw new Error('Editorial page registry is empty')
  return rows
}

export function authoredNavigation(tree: string) {
  const block = tree.match(
    /<!-- CANONICAL_TREE_BEGIN -->\r?\n([\s\S]*?)\r?\n<!-- CANONICAL_TREE_END -->/,
  )?.[1]
  if (!block) throw new Error('Missing canonical tree registry')

  const rootPages: EditorialPage[] = []
  const sections: CanonicalNavigationSection[] = []
  let section: CanonicalNavigationSection | undefined
  let folder: Extract<CanonicalNavigationItem, { kind: 'folder' }> | undefined
  let atRoot = false

  for (const line of block.split(/\r?\n/)) {
    if (line === '## Root entry') {
      atRoot = true
      section = undefined
      folder = undefined
      continue
    }

    const sectionLabel = line.match(/^## \d+\. (.+)$/)?.[1]
    if (sectionLabel) {
      atRoot = false
      section = { items: [], label: sectionLabel }
      sections.push(section)
      folder = undefined
      continue
    }

    const folderLabel = line.match(/^\*\*Visible folder: (.+)\*\*$/)?.[1]
    if (folderLabel) {
      if (!section) {
        throw new Error(
          `Visible folder has no canonical section: ${folderLabel}`,
        )
      }
      folder = { kind: 'folder', label: folderLabel, pages: [] }
      section.items.push(folder)
      continue
    }

    const page = editorialPage(line)
    if (!page) continue
    if (atRoot) {
      rootPages.push(page)
    } else if (folder) {
      folder.pages.push(page)
    } else if (section) {
      section.items.push({ kind: 'page', page })
    } else {
      throw new Error(`Canonical page has no navigation parent: ${page.id}`)
    }
  }

  const pages = [
    ...rootPages,
    ...sections.flatMap((item) =>
      item.items.flatMap((entry) =>
        entry.kind === 'page' ? [entry.page] : entry.pages,
      ),
    ),
  ]
  const accepted = editorialPages(tree)
  if (
    rootPages.length !== 1 ||
    sections.length === 0 ||
    pages.map((page) => page.id).join('\0') !==
      accepted.map((page) => page.id).join('\0')
  ) {
    throw new Error('Canonical navigation does not account for every page')
  }

  return { root: rootPages[0], sections }
}

export function clickableNavigationIndexes(tree: string) {
  const section = tree.match(
    /These page nodes are clickable folder indexes and must remain visible:\r?\n([\s\S]*?)\r?\nAll other bold nested folders/,
  )?.[1]
  if (!section) throw new Error('Missing clickable navigation index registry')

  const rows = section.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\| P\d{3} `(\/[^`]*)`\s+\| (.+?)\s+\|$/)
    return match ? [{ label: match[2], path: match[1] }] : []
  })
  uniqueRows(rows, (row) => row.path, 'Clickable navigation index paths')
  uniqueRows(rows, (row) => row.label, 'Clickable navigation index labels')
  if (rows.length === 0) {
    throw new Error('Clickable navigation index registry is empty')
  }
  return rows
}

export function openAPINavigationGroups(tree: string) {
  const section = tree.match(
    /\| Generated group order \| Visible generated group \| Exact OpenAPI tag[\s\S]*?\r?\n([\s\S]*?)\r?\nFor compatibility entry points/,
  )?.[1]
  if (!section) throw new Error('Missing generated OpenAPI group registry')

  const rows = section.split(/\r?\n/).flatMap((line) => {
    const columns = line.split('|').map((column) => column.trim())
    const order = Number(columns[1])
    const tag = columns[3]?.match(/^`([^`]+)`$/)?.[1]
    if (!Number.isInteger(order) || !columns[2] || !tag) return []
    return [{ label: columns[2], order, tag }]
  })
  uniqueRows(rows, (row) => row.label, 'Generated OpenAPI group labels')
  uniqueRows(rows, (row) => row.tag, 'Generated OpenAPI group tags')
  if (rows.length === 0 || rows.some((row, index) => row.order !== index + 1)) {
    throw new Error('Generated OpenAPI group order is incomplete')
  }
  return rows.map(({ label, tag }): OpenAPINavigationGroup => ({ label, tag }))
}

export function openAPICategoryGroups(tree: string) {
  const section = tree.match(
    /\| Generated category node \| Exact generated tag group\(s\)[\s\S]*?\r?\n([\s\S]*?)\r?\nEach generated page title/,
  )?.[1]
  if (!section) throw new Error('Missing generated OpenAPI category registry')

  const rows = section.split(/\r?\n/).flatMap((line) => {
    const columns = line.split('|').map((column) => column.trim())
    if (!columns[1] || !columns[2]) return []
    const tags = [...columns[2].matchAll(/`([^`]+)`/g)].map((match) => match[1])
    return tags.length > 0 ? [{ label: columns[1], tags }] : []
  })
  uniqueRows(rows, (row) => row.label, 'Generated OpenAPI category labels')
  uniqueRows(
    rows.flatMap((row) => row.tags),
    (tag) => tag,
    'Generated OpenAPI category tags',
  )
  if (rows.length === 0) {
    throw new Error('Generated OpenAPI category registry is empty')
  }
  return rows satisfies OpenAPICategoryGroup[]
}

export function sourceTerminals(contract: string) {
  const lines = markedBlock(contract, 'SOURCE_TERMINALS')
    .split(/\r?\n/)
    .filter((line) => /^S\d{3}\s+\|/.test(line))
  const rows = lines.map((line): SourceTerminal => {
    const columns = line.split('|').map((column) => column.trim())
    const response = Number(columns[3])
    if (
      !/^S\d{3}$/.test(columns[0] ?? '') ||
      !(response === 200 || response === 301 || response === 404) ||
      !columns[1]?.startsWith('/') ||
      !columns[2]
    ) {
      throw new Error(`Malformed source terminal row: ${line}`)
    }
    const terminal = columns[4] === '-' ? undefined : columns[4]
    if (
      response === 404 ? terminal !== undefined : !terminal?.startsWith('/')
    ) {
      throw new Error(`Invalid source terminal target: ${line}`)
    }
    return {
      disposition: columns[2],
      id: columns[0],
      response,
      source: columns[1],
      terminal,
    }
  })
  uniqueRows(rows, (row) => row.id, 'Source terminal IDs')
  uniqueRows(rows, (row) => row.source, 'Source terminal paths')
  return rows
}

export function historicAliases(contract: string) {
  const section = contract.match(
    /## Historic aliases\r?\n([\s\S]*?)\r?\n## Finite slash and alias rules/,
  )?.[1]
  if (!section) throw new Error('Missing historic aliases section')

  const rows = section
    .split(/\r?\n/)
    .map((line) => line.split('|').map((column) => column.trim()))
    .flatMap((columns) => {
      const source = columns[1]?.match(/^`(\/[^`]+)`$/)?.[1]
      const target = columns[2]?.match(/^`(\/[^`]+)`$/)?.[1]
      return source && target ? [{ source, target }] : []
    })

  uniqueRows(rows, (row) => row.source, 'Historic aliases')
  if (rows.length === 0) throw new Error('Historic aliases registry is empty')
  return rows
}

export function requiredInternalLinkRewrites(contract: string) {
  const section = contract.match(
    /## Required internal-link rewrites\r?\n([\s\S]*?)\r?\n## Historic aliases/,
  )?.[1]
  if (!section) throw new Error('Missing required internal-link rewrites')

  const rows = section
    .split(/\r?\n/)
    .map((line) => line.split('|').map((column) => column.trim()))
    .flatMap((columns) => {
      const source = columns[1]?.match(/^`(\/[^`]+)`$/)?.[1]
      const target = columns[2]?.match(/^`(\/[^`]+)`$/)?.[1]
      return source && target ? [{ source, target }] : []
    })

  uniqueRows(rows, (row) => row.source, 'Internal-link rewrite sources')
  uniqueRows(rows, (row) => row.target, 'Internal-link rewrite targets')
  if (rows.length === 0) {
    throw new Error('Required internal-link rewrite registry is empty')
  }
  return rows
}

export function acceptedOperationIds(contract: string) {
  const preserved = markedBlock(contract, 'OPENAPI_OPERATION_URLS')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((url) => {
      const match = url.match(/^\/openapi\/operations\/([^/]+)$/)
      if (!match) throw new Error(`Malformed preserved operation URL: ${url}`)
      return match[1]
    })

  const additions = contract.split(/\r?\n/).flatMap((line) => {
    const match = line.match(
      /^\| `([A-Z]+) ([^`]+)`\s+\| `([^`]+)`\s+\| `\/openapi\/operations\/([^`]+)`\s+\|/,
    )
    if (!match) return []
    if (match[3] !== match[4]) {
      throw new Error(`Parity operation ID and URL disagree: ${line}`)
    }
    return [
      {
        id: match[3],
        methodPath: `${match[1]} ${match[2]}`,
      },
    ]
  })

  uniqueRows(preserved, (id) => id, 'Preserved operation IDs')
  uniqueRows(additions, (row) => row.id, 'Parity operation IDs')
  uniqueRows(additions, (row) => row.methodPath, 'Parity method/path pairs')
  if (preserved.length === 0 || additions.length === 0) {
    throw new Error('Accepted operation registries must not be empty')
  }
  return { additions, preserved }
}

function slashful(path: string) {
  if (path === '/') throw new Error('The root canonical has no slash alias')
  return `${path}/`
}

export function buildRedirectRules({
  canonicalPages,
  contract,
}: {
  canonicalPages: string[]
  contract: string
}) {
  const moved = sourceTerminals(contract).filter(
    (row): row is SourceTerminal & { terminal: string } =>
      row.response === 301 && row.terminal !== undefined,
  )
  const historic = historicAliases(contract)
  const rules: RedirectRule[] = [
    ...moved.map((row) => ({
      source: slashful(row.source),
      status: 301 as const,
      target: row.terminal,
    })),
    ...historic.map((row) => ({
      source: slashful(row.source),
      status: 301 as const,
      target: row.target,
    })),
    ...moved.map((row) => ({
      source: row.source,
      status: 301 as const,
      target: row.terminal,
    })),
    ...historic.map((row) => ({
      source: row.source,
      status: 301 as const,
      target: row.target,
    })),
    ...canonicalPages
      .filter((route) => route !== '/')
      .map((route) => ({
        source: slashful(route),
        status: 301 as const,
        target: route,
      })),
  ]

  uniqueRows(rules, (rule) => rule.source, 'Redirect sources')
  const canonicals = new Set(canonicalPages)
  const sources = new Set(rules.map((rule) => rule.source))
  for (const rule of rules) {
    if (!canonicals.has(rule.target)) {
      throw new Error(`Redirect target is not canonical: ${rule.target}`)
    }
    if (sources.has(rule.target)) {
      throw new Error(`Redirect chain or cycle through ${rule.target}`)
    }
    if (rule.source === rule.target) {
      throw new Error(`Self redirect at ${rule.source}`)
    }
  }

  return rules
}

export function serializeRedirectRules(rules: RedirectRule[]) {
  return `${rules
    .map((rule) => `${rule.source} ${rule.target} ${rule.status}`)
    .join('\n')}\n`
}
