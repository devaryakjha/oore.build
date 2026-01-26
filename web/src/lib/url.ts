/**
 * URL validation utilities for external URLs from API responses.
 * Prevents potential malicious URL injection if API is compromised.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Validates and sanitizes an external URL.
 * Returns the URL if valid, or null if potentially malicious.
 */
export function validateExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)

    // Only allow http/https protocols
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return null
    }

    return url
  } catch {
    // Invalid URL
    return null
  }
}

/**
 * Checks if a URL is valid for use in an href.
 */
export function isValidExternalUrl(url: string | null | undefined): boolean {
  return validateExternalUrl(url) !== null
}

/**
 * Validates a Git URL (https or git protocol).
 */
export function validateGitUrl(url: string | null | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)

    // Allow http, https for clone URLs
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return url
    }

    return null
  } catch {
    // Could be a git:// or ssh URL, validate basic structure
    if (url.startsWith('git@') || url.startsWith('ssh://') || url.startsWith('git://')) {
      // Basic validation for SSH/git URLs
      return url
    }
    return null
  }
}
