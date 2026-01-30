import useSWR from 'swr'
import { fetcher } from './client'
import { API_BASE_URL } from '@/lib/constants'

// ============================================================================
// Types
// ============================================================================

export interface BuildArtifact {
  id: string
  build_id: string
  name: string
  relative_path: string
  size_bytes: number
  content_type?: string
  checksum_sha256?: string
  created_at: string
  download_url: string
}

// ============================================================================
// API Keys
// ============================================================================

const artifactsKey = (buildId: string) => `/api/builds/${buildId}/artifacts`

// ============================================================================
// Hooks
// ============================================================================

export function useBuildArtifacts(buildId: string | null) {
  return useSWR<BuildArtifact[]>(
    buildId ? artifactsKey(buildId) : null,
    fetcher
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Returns the full download URL for an artifact.
 * This URL can be used directly for downloading (e.g., in an anchor tag).
 */
export function getArtifactDownloadUrl(
  buildId: string,
  artifactId: string
): string {
  return `${API_BASE_URL}/api/builds/${buildId}/artifacts/${artifactId}`
}

/**
 * Formats file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

/**
 * Returns a display name for common artifact types based on file extension.
 */
export function getArtifactTypeLabel(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'ipa':
      return 'iOS App'
    case 'apk':
      return 'Android APK'
    case 'aab':
      return 'Android App Bundle'
    case 'xcarchive':
      return 'Xcode Archive'
    case 'dsym':
      return 'Debug Symbols'
    case 'zip':
      return 'Archive'
    case 'log':
    case 'txt':
      return 'Log File'
    case 'json':
      return 'JSON'
    case 'xml':
      return 'XML'
    default:
      return 'File'
  }
}
