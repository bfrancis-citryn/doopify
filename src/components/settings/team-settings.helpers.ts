export function isOwnerRole(role: string | null | undefined) {
  return role === 'OWNER'
}

export function isKnownNonOwnerRole(role: string | null | undefined) {
  return Boolean(role) && !isOwnerRole(role)
}

export function getTeamAccessNotice(role: string | null | undefined) {
  if (!role) return ''
  if (isOwnerRole(role)) return ''
  return 'Team management is owner-only in private beta. Your role has read-only access to settings outside this tab.'
}
