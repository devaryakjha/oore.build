/**
 * HUML (Human-oriented Markup Language) syntax support for Monaco Editor.
 *
 * Based on the HUML v0.2.0 specification.
 * @see https://huml.io
 */
import type * as Monaco from 'monaco-editor'

export const HUML_LANGUAGE_ID = 'huml'

/**
 * Language configuration for HUML (brackets, comments, auto-closing, etc.)
 */
export const humlLanguageConfiguration: Monaco.languages.LanguageConfiguration =
  {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^\s*.*::\s*(#.*)?$/,
        end: /^\s*$/,
      },
    },
    indentationRules: {
      increaseIndentPattern: /^\s*.*::\s*(#.*)?$/,
      decreaseIndentPattern: /^\s*$/,
    },
    wordPattern: /[a-zA-Z0-9_-]+/,
  }

/**
 * Monarch tokenizer for HUML syntax highlighting.
 *
 * Monarch is Monaco's built-in syntax highlighting engine.
 * @see https://microsoft.github.io/monaco-editor/monarch.html
 */
export const humlMonarchTokens: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.huml',

  // Keywords and constants
  keywords: ['true', 'false', 'null', 'inf', 'nan'],

  // Escape sequences in strings
  escapes: /\\[\\"\\\/bfnrt]/,

  // Tokenizer rules
  tokenizer: {
    root: [
      // Version declaration: %HUML v0.2.0
      [/^%HUML\s+v?\d+\.\d+(\.\d+)?/, 'meta.version'],

      // Comments
      [/#.*$/, 'comment'],

      // List item marker
      [/^\s*-\s/, 'delimiter.list'],

      // Vector key (double colon): key::
      [
        /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*|"[^"]*")(\s*)(::)/,
        ['white', 'tag.vector', 'white', 'delimiter.vector'],
      ],

      // Scalar key (single colon): key:
      [
        /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*|"[^"]*")(\s*)(:)(?!:)/,
        ['white', 'tag.scalar', 'white', 'delimiter.scalar'],
      ],

      // Inline key in dict: key:
      [
        /([a-zA-Z_][a-zA-Z0-9_-]*|"[^"]*")(\s*)(:)(?!:)/,
        ['tag.inline', 'white', 'delimiter.scalar'],
      ],

      // Include value patterns
      { include: '@values' },

      // Whitespace
      [/\s+/, 'white'],
    ],

    values: [
      // Triple-quoted strings (multiline)
      [/"""/, 'string.quote', '@multilineString'],
      [/```/, 'string.quote', '@multilineBacktick'],

      // Double-quoted strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // Unterminated
      [/"/, 'string.quote', '@string'],

      // Special numeric values
      [/\b(nan|inf|-inf|\+inf)\b/, 'number.special'],

      // Hex numbers: 0xFF
      [/\b0x[0-9A-Fa-f_]+\b/, 'number.hex'],

      // Octal numbers: 0o77
      [/\b0o[0-7_]+\b/, 'number.octal'],

      // Binary numbers: 0b1010
      [/\b0b[01_]+\b/, 'number.binary'],

      // Decimal numbers with optional exponent
      [/-?\d[\d_]*(\.\d[\d_]*)?([eE][-+]?\d[\d_]*)?/, 'number'],

      // Boolean literals
      [/\b(true|false)\b/, 'keyword.boolean'],

      // Null literal
      [/\bnull\b/, 'keyword.null'],

      // Empty containers
      [/\[\]/, 'delimiter.empty'],
      [/\{\}/, 'delimiter.empty'],

      // Comma separator (inline values)
      [/,/, 'delimiter.comma'],

      // Brackets
      [/[{}\[\]]/, 'delimiter.bracket'],
    ],

    // Double-quoted string state
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string.quote', '@pop'],
    ],

    // Triple-quoted multiline string state
    multilineString: [
      [/"""/, 'string.quote', '@pop'],
      [/./, 'string'],
    ],

    // Triple-backtick multiline string state
    multilineBacktick: [
      [/```/, 'string.quote', '@pop'],
      [/./, 'string'],
    ],
  },
}

/**
 * Registers the HUML language with Monaco Editor.
 *
 * Call this once when Monaco is available.
 */
export function registerHumlLanguage(monaco: typeof Monaco): void {
  // Check if already registered
  const languages = monaco.languages.getLanguages()
  if (languages.some((lang) => lang.id === HUML_LANGUAGE_ID)) {
    return
  }

  // Register the language
  monaco.languages.register({
    id: HUML_LANGUAGE_ID,
    extensions: ['.huml'],
    aliases: ['HUML', 'huml'],
    mimetypes: ['text/x-huml'],
  })

  // Set language configuration
  monaco.languages.setLanguageConfiguration(
    HUML_LANGUAGE_ID,
    humlLanguageConfiguration
  )

  // Set Monarch tokenizer
  monaco.languages.setMonarchTokensProvider(
    HUML_LANGUAGE_ID,
    humlMonarchTokens
  )
}
