type SessionUserLike = {
  id?: unknown
  email?: unknown
  firstName?: unknown
  lastName?: unknown
  role?: unknown
}

export function normalizeSettingsSessionUser(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const input = value as SessionUserLike
  const id = typeof input.id === 'string' ? input.id : null
  const email = typeof input.email === 'string' ? input.email : null
  const role = typeof input.role === 'string' ? input.role : null

  if (!id || !email || !role) return null

  return {
    id,
    email,
    role,
    firstName: typeof input.firstName === 'string' ? input.firstName : null,
    lastName: typeof input.lastName === 'string' ? input.lastName : null,
  }
}
