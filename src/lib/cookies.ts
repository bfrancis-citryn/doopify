function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null

  const pattern = new RegExp(`(?:^|;\\s*)${escapeRegExp(name)}=([^;]+)`)
  const match = cookieHeader.match(pattern)
  return match ? decodeURIComponent(match[1]) : null
}
