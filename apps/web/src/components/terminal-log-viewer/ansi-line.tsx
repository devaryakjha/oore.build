import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ThemedToken } from 'shiki'

const FONT_STYLE_ITALIC = 1
const FONT_STYLE_BOLD = 2
const FONT_STYLE_UNDERLINE = 4
const FONT_STYLE_STRIKETHROUGH = 8

type AnsiTokenizer = (content: string) => Array<Array<ThemedToken>>

const ANSI_ESCAPE = String.fromCharCode(27)
let tokenizerPromise: Promise<AnsiTokenizer> | null = null

function plainTokens(content: string): Array<Array<ThemedToken>> {
  let plain = ''
  let cursor = 0

  while (cursor < content.length) {
    if (content[cursor] !== ANSI_ESCAPE || content[cursor + 1] !== '[') {
      plain += content[cursor]
      cursor += 1
      continue
    }

    cursor += 2
    while (cursor < content.length) {
      const character = content.charCodeAt(cursor)
      cursor += 1
      if (character >= 64 && character <= 126) break
    }
  }

  return [[{ content: plain, offset: 0 }]]
}

function loadAnsiTokenizer() {
  tokenizerPromise ??= import('shiki/core').then(
    ({ createCssVariablesTheme, normalizeTheme, tokenizeAnsiWithTheme }) => {
      const ansiTheme = normalizeTheme(
        createCssVariablesTheme({
          name: 'oore-ansi',
          variableDefaults: {
            foreground: 'var(--foreground)',
            background: 'var(--background)',
            'ansi-black': 'var(--muted-foreground)',
            'ansi-red': 'var(--destructive)',
            'ansi-green': 'var(--success)',
            'ansi-yellow': 'var(--warning)',
            'ansi-blue': 'var(--info)',
            'ansi-magenta':
              'color-mix(in oklch, var(--info) 55%, var(--destructive))',
            'ansi-cyan': 'var(--info)',
            'ansi-white': 'var(--foreground)',
            'ansi-bright-black': 'var(--muted-foreground)',
            'ansi-bright-red':
              'color-mix(in oklch, var(--destructive) 75%, var(--foreground))',
            'ansi-bright-green':
              'color-mix(in oklch, var(--success) 75%, var(--foreground))',
            'ansi-bright-yellow':
              'color-mix(in oklch, var(--warning) 75%, var(--foreground))',
            'ansi-bright-blue':
              'color-mix(in oklch, var(--info) 75%, var(--foreground))',
            'ansi-bright-magenta':
              'color-mix(in oklch, var(--info) 45%, var(--destructive))',
            'ansi-bright-cyan':
              'color-mix(in oklch, var(--info) 70%, var(--foreground))',
            'ansi-bright-white': 'var(--foreground)',
          },
        }),
      )

      return (content: string) => tokenizeAnsiWithTheme(ansiTheme, content)
    },
  )
  return tokenizerPromise
}

function tokenStyle(token: ThemedToken): CSSProperties {
  const fontStyle = token.fontStyle ?? 0
  return {
    color: token.color,
    backgroundColor: token.bgColor,
    fontStyle: fontStyle & FONT_STYLE_ITALIC ? ('italic' as const) : undefined,
    fontWeight: fontStyle & FONT_STYLE_BOLD ? 700 : undefined,
    textDecoration: [
      fontStyle & FONT_STYLE_UNDERLINE ? 'underline' : '',
      fontStyle & FONT_STYLE_STRIKETHROUGH ? 'line-through' : '',
    ]
      .filter(Boolean)
      .join(' '),
  }
}

function HighlightedText({
  content,
  searchQuery,
}: {
  content: string
  searchQuery: string
}) {
  const query = searchQuery.trim()
  if (!query) return content

  const normalizedContent = content.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()
  const parts: Array<ReactNode> = []
  let cursor = 0
  let matchIndex = normalizedContent.indexOf(normalizedQuery)

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(content.slice(cursor, matchIndex))
    }
    const matchEnd = matchIndex + query.length
    parts.push(
      <mark
        key={`${matchIndex}-${matchEnd}`}
        className="rounded-sm bg-primary/20 text-inherit"
      >
        {content.slice(matchIndex, matchEnd)}
      </mark>,
    )
    cursor = matchEnd
    matchIndex = normalizedContent.indexOf(normalizedQuery, cursor)
  }

  if (cursor < content.length) parts.push(content.slice(cursor))
  return parts.length > 0 ? parts : content
}

export function AnsiLine({
  content,
  searchQuery,
}: {
  content: string
  searchQuery: string
}) {
  const [lines, setLines] = useState(() => plainTokens(content))

  useEffect(() => {
    let active = true
    setLines(plainTokens(content))
    if (!content.includes(`${ANSI_ESCAPE}[`)) return

    void loadAnsiTokenizer().then((tokenize) => {
      if (!active) return
      try {
        setLines(tokenize(content))
      } catch {
        setLines(plainTokens(content))
      }
    })

    return () => {
      active = false
    }
  }, [content])

  return lines.map((line, lineIndex) => (
    <span key={lineIndex}>
      {line.map((token, tokenIndex) => (
        <span key={`${token.offset}-${tokenIndex}`} style={tokenStyle(token)}>
          <HighlightedText content={token.content} searchQuery={searchQuery} />
        </span>
      ))}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ))
}
