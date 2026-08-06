export function formatReleaseNotes(notes: string): string {
  return notes
    .replace(/^#{1,6}\s+.*(?:\r?\n)+/, '')
    .replace(/^\*\*Full Changelog\*\*:.*$/gim, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim()
}

export function installerCommand(channel: string): string {
  if (channel === 'alpha' || channel === 'beta') {
    return `curl -fL https://${channel}.oore.pages.dev/install -o oore-install.sh\nless oore-install.sh\nOORE_CHANNEL=${channel} bash oore-install.sh`
  }
  return 'curl -fL https://oore.build/install -o oore-install.sh\nless oore-install.sh\nbash oore-install.sh'
}
