import AnsiToHtml from 'ansi-to-html'

// Create a single instance with our preferred options
// The escapeXML option sanitizes the content to prevent XSS
const converter = new AnsiToHtml({
  fg: 'currentColor',
  bg: 'transparent',
  newline: true,
  escapeXML: true, // This sanitizes HTML entities to prevent XSS
  colors: {
    // Standard ANSI colors - terminal-inspired palette
    0: '#6b7280', // black -> gray-500
    1: '#ef4444', // red
    2: '#22c55e', // green
    3: '#eab308', // yellow
    4: '#3b82f6', // blue
    5: '#a855f7', // magenta
    6: '#06b6d4', // cyan
    7: '#f3f4f6', // white -> gray-100
    // Bright variants
    8: '#9ca3af', // bright black -> gray-400
    9: '#f87171', // bright red
    10: '#4ade80', // bright green
    11: '#facc15', // bright yellow
    12: '#60a5fa', // bright blue
    13: '#c084fc', // bright magenta
    14: '#22d3ee', // bright cyan
    15: '#ffffff', // bright white
  },
})

/**
 * Convert ANSI escape codes to HTML with inline styles.
 * Content is sanitized via escapeXML to prevent XSS.
 * Safe for rendering in React.
 */
export function ansiToHtml(text: string): string {
  if (!text) return ''
  return converter.toHtml(text)
}

/**
 * Strip all ANSI escape codes from text.
 * Useful for plain text display or copying.
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}
