import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import type { UserRole } from '@prisma/client'

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const PASSWORD_RESET_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const TEAM_MANAGEABLE_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'STAFF', 'VIEWER']
const TEAM_ROLE_ENUM_DRIFT_ERROR =
  'Team role ADMIN is not available in the database schema. Apply the latest Prisma migration (or run `npm run db:push` for this environment) and redeploy.'

function mapTeamRolePersistenceError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('Team role update failed.')

  const message = error.message || ''
  const normalized = message.toLowerCase()
  const looksLikeEnumMismatch =
    normalized.includes('userrole') &&
    normalized.includes('admin') &&
    (normalized.includes('invalid input value for enum') ||
      normalized.includes('value') ||
      normalized.includes('enum'))

  if (looksLikeEnumMismatch) {
    return new Error(TEAM_ROLE_ENUM_DRIFT_ERROR)
  }

  return error
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t || null
}

// ── Last-owner guard ────────────────────────────────────────────────────────

async function countActiveOwners(excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: 'OWNER',
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  })
}

async function assertNotLastOwner(userId: string, operation: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  })
  if (!user || user.role !== 'OWNER') return

  const remaining = await countActiveOwners(userId)
  if (remaining < 1) {
    throw new Error(`Cannot ${operation}: this is the only active OWNER account.`)
  }
}

// ── Setup token validation ──────────────────────────────────────────────────

function validateSetupToken(suppliedToken: string | null | undefined) {
  const required = trimToNull(env.SETUP_TOKEN)

  // In production, SETUP_TOKEN must be configured. If it is not set, deny bootstrap.
  if (!required && env.NODE_ENV === 'production') {
    throw new Error(
      'SETUP_TOKEN is required in production. Set SETUP_TOKEN in your environment variables before creating the first owner account.'
    )
  }

  if (!required) return // development/test: open bootstrap when no token is configured

  const supplied = trimToNull(suppliedToken)
  if (!supplied || supplied !== required) {
    throw new Error('Invalid setup token.')
  }
}

// ── Owner exists check ──────────────────────────────────────────────────────

export async function activeOwnerExists(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: 'OWNER', isActive: true } })
  return count > 0
}

// ── Bootstrap: create first owner ──────────────────────────────────────────

export type BootstrapOwnerInput = {
  email: string
  password: string
  firstName?: string | null
  lastName?: string | null
  setupToken?: string | null
}

export async function bootstrapOwner(input: BootstrapOwnerInput) {
  validateSetupToken(input.setupToken)

  const email = normalizeEmail(input.email)
  const password = trimToNull(input.password)
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  // Re-check inside transaction to prevent races
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { role: 'OWNER', isActive: true },
      select: { id: true },
    })
    if (existing) {
      throw new Error('An owner account already exists.')
    }

    const existingEmail = await tx.user.findUnique({ where: { email }, select: { id: true } })
    if (existingEmail) {
      throw new Error('An account with this email already exists.')
    }

    const passwordHash = await bcrypt.hash(password, 12)

    return tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: trimToNull(input.firstName),
        lastName: trimToNull(input.lastName),
        role: 'OWNER',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    })
  })

  await recordAuditLogBestEffort({
    action: 'team.owner_created',
    actor: { actorType: 'SYSTEM' },
    resource: { type: 'User', id: created.id },
    summary: `First owner account created: ${created.email}`,
    snapshot: { email: created.email, role: 'OWNER' },
  })

  return created
}

// ── List team users ─────────────────────────────────────────────────────────

export type TeamUserView = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

export async function listTeamUsers(): Promise<TeamUserView[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  })
}

// ── Create user directly (owner-only) ───────────────────────────────────────

export type CreateTeamUserInput = {
  email: string
  password: string
  firstName?: string | null
  lastName?: string | null
  role: UserRole
}

export async function createTeamUser(input: CreateTeamUserInput) {
  if (!TEAM_MANAGEABLE_ROLES.includes(input.role)) {
    throw new Error('Invalid role.')
  }
  const email = normalizeEmail(input.email)
  const password = trimToNull(input.password)
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    throw new Error('An account with this email already exists.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    return await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: trimToNull(input.firstName),
        lastName: trimToNull(input.lastName),
        role: input.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })
  } catch (error) {
    throw mapTeamRolePersistenceError(error)
  }
}

// ── Invite user ─────────────────────────────────────────────────────────────

export type InviteTeamUserInput = {
  email: string
  role: UserRole
  invitedById?: string | null
}

export type TeamInviteView = {
  id: string
  email: string
  role: UserRole
  expiresAt: Date
  createdAt: Date
  invitedById: string | null
}

export async function inviteTeamUser(input: InviteTeamUserInput): Promise<{
  invite: TeamInviteView
  rawToken: string
}> {
  if (!TEAM_MANAGEABLE_ROLES.includes(input.role)) {
    throw new Error('Invalid role.')
  }
  const email = normalizeEmail(input.email)

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existingUser) {
    throw new Error('A user with this email already exists.')
  }

  // Check for existing pending invite
  const existingInvite = await prisma.userInvite.findFirst({
    where: { email, expiresAt: { gt: new Date() } },
    select: { id: true },
  })
  if (existingInvite) {
    throw new Error('A pending invite for this email already exists. Revoke it first or resend it.')
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS)

  let invite
  try {
    invite = await prisma.userInvite.create({
      data: {
        email,
        role: input.role,
        tokenHash,
        expiresAt,
        invitedById: input.invitedById ?? null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedById: true,
      },
    })
  } catch (error) {
    throw mapTeamRolePersistenceError(error)
  }

  await recordAuditLogBestEffort({
    action: 'team.invite_created',
    actor: input.invitedById ? { actorType: 'STAFF', actorId: input.invitedById } : { actorType: 'SYSTEM' },
    resource: { type: 'UserInvite', id: invite.id },
    summary: `Invite created for ${email} with role ${input.role}`,
    snapshot: { email, role: input.role },
    redactions: ['tokenHash'],
  })

  return { invite, rawToken }
}

// ── Accept invite ───────────────────────────────────────────────────────────

export type AcceptInviteInput = {
  rawToken: string
  password: string
  firstName?: string | null
  lastName?: string | null
}

export async function acceptTeamInvite(input: AcceptInviteInput) {
  const password = trimToNull(input.password)
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  // Find unexpired invites and check each token hash
  const candidates = await prisma.userInvite.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, tokenHash: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  let matched: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    const ok = await bcrypt.compare(input.rawToken, candidate.tokenHash)
    if (ok) {
      matched = candidate
      break
    }
  }

  if (!matched) {
    throw new Error('Invalid or expired invite link.')
  }

  const email = normalizeEmail(matched.email)

  const newUser = await prisma.$transaction(async (tx) => {
    // Delete the invite (single-use)
    await tx.userInvite.delete({ where: { id: matched!.id } })

    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) {
      throw new Error('An account with this email already exists.')
    }

    const passwordHash = await bcrypt.hash(password, 12)

    return tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: trimToNull(input.firstName),
        lastName: trimToNull(input.lastName),
        role: matched!.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    })
  })

  await recordAuditLogBestEffort({
    action: 'team.invite_accepted',
    actor: { actorType: 'STAFF', actorId: newUser.id, actorEmail: newUser.email, actorRole: newUser.role },
    resource: { type: 'User', id: newUser.id },
    summary: `Invite accepted: ${newUser.email} joined as ${newUser.role}`,
    snapshot: { email: newUser.email, role: newUser.role },
  })

  return newUser
}

// ── Update user role ────────────────────────────────────────────────────────

export async function updateTeamUserRole(
  userId: string,
  newRole: UserRole,
  actor?: { id: string; email: string; role: UserRole | string } | null
) {
  if (!TEAM_MANAGEABLE_ROLES.includes(newRole)) {
    throw new Error('Invalid role.')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true },
  })
  if (!user) throw new Error('User not found.')

  if (user.role === 'OWNER' && newRole !== 'OWNER') {
    await assertNotLastOwner(userId, 'demote this user from OWNER')
  }

  let updated
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    })
  } catch (error) {
    throw mapTeamRolePersistenceError(error)
  }

  await recordAuditLogBestEffort({
    action: 'team.role_changed',
    actor: actor ? { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role } : { actorType: 'SYSTEM' },
    resource: { type: 'User', id: userId },
    summary: `Role changed for ${user.email}: ${user.role} → ${newRole}`,
    snapshot: { previousRole: user.role, newRole },
  })

  return updated
}

// ── Disable user ────────────────────────────────────────────────────────────

export type UpdateTeamUserProfileInput = {
  firstName?: string | null
  lastName?: string | null
}

export async function updateTeamUserProfile(
  userId: string,
  input: UpdateTeamUserProfileInput,
  actor?: { id: string; email: string; role: UserRole | string } | null
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })
  if (!user) throw new Error('User not found.')

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: trimToNull(input.firstName),
      lastName: trimToNull(input.lastName),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  await recordAuditLogBestEffort({
    action: 'team.user_profile_updated',
    actor: actor ? { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role } : { actorType: 'SYSTEM' },
    resource: { type: 'User', id: userId },
    summary: `Team profile updated for ${user.email}`,
    snapshot: {
      email: user.email,
      previousFirstName: user.firstName,
      previousLastName: user.lastName,
      nextFirstName: updated.firstName,
      nextLastName: updated.lastName,
    },
  })

  return updated
}

export async function disableTeamUser(
  userId: string,
  actor?: { id: string; email: string; role: UserRole | string } | null
) {
  await assertNotLastOwner(userId, 'disable this user')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } })
  if (!user) throw new Error('User not found.')

  // Invalidate all sessions immediately
  await prisma.session.deleteMany({ where: { userId } })

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { id: true, email: true, role: true, isActive: true },
  })

  await recordAuditLogBestEffort({
    action: 'team.user_disabled',
    actor: actor ? { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role } : { actorType: 'SYSTEM' },
    resource: { type: 'User', id: userId },
    summary: `User disabled: ${user.email}`,
    snapshot: { email: user.email, role: user.role },
  })

  return updated
}

// ── Reactivate user ─────────────────────────────────────────────────────────

export async function deleteDisabledTeamUser(
  userId: string,
  actor: { id: string; email: string; role: UserRole | string }
) {
  if (actor.id === userId) {
    throw new Error('You cannot delete your own account.')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true },
  })
  if (!user) throw new Error('User not found.')
  if (user.isActive) throw new Error('Only disabled users can be deleted.')

  if (user.role === 'OWNER') {
    const otherOwners = await prisma.user.count({
      where: {
        role: 'OWNER',
        id: { not: userId },
      },
    })
    if (otherOwners < 1) {
      throw new Error('Cannot delete this user: this is the only OWNER account.')
    }
  }

  const cleanup = await prisma.$transaction(async (tx) => {
    const deletedSessions = await tx.session.deleteMany({ where: { userId } })
    const deletedPasswordResets = await tx.passwordReset.deleteMany({ where: { userId } })
    const deletedMfaChallenges = await tx.mfaLoginChallenge.deleteMany({ where: { userId } })
    await tx.user.delete({ where: { id: userId } })

    return {
      sessionsDeleted: deletedSessions.count,
      passwordResetsDeleted: deletedPasswordResets.count,
      mfaChallengesDeleted: deletedMfaChallenges.count,
    }
  })

  await recordAuditLogBestEffort({
    action: 'team.user_deleted',
    actor: { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role },
    resource: { type: 'User', id: userId },
    summary: `Disabled user deleted: ${user.email}`,
    snapshot: {
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      cleanup,
    },
  })

  return {
    id: user.id,
    email: user.email,
    deleted: true as const,
    cleanup,
  }
}

export async function reactivateTeamUser(
  userId: string,
  actor?: { id: string; email: string; role: UserRole | string } | null
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } })
  if (!user) throw new Error('User not found.')

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    select: { id: true, email: true, role: true, isActive: true },
  })

  await recordAuditLogBestEffort({
    action: 'team.user_reactivated',
    actor: actor ? { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role } : { actorType: 'SYSTEM' },
    resource: { type: 'User', id: userId },
    summary: `User reactivated: ${user.email}`,
    snapshot: { email: user.email, role: user.role },
  })

  return updated
}

// ── Revoke invite ───────────────────────────────────────────────────────────

export async function revokeTeamInvite(inviteId: string) {
  const invite = await prisma.userInvite.findUnique({ where: { id: inviteId }, select: { id: true } })
  if (!invite) throw new Error('Invite not found.')

  await prisma.userInvite.delete({ where: { id: inviteId } })
}

// ── Resend invite ───────────────────────────────────────────────────────────

export async function resendTeamInvite(inviteId: string): Promise<{
  invite: TeamInviteView
  rawToken: string
}> {
  const invite = await prisma.userInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, email: true, role: true, invitedById: true },
  })
  if (!invite) throw new Error('Invite not found.')

  // Replace with a fresh token and reset expiry
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS)

  const updated = await prisma.userInvite.update({
    where: { id: inviteId },
    data: { tokenHash, expiresAt },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedById: true },
  })

  return { invite: updated, rawToken }
}

// ── List pending invites ────────────────────────────────────────────────────

export async function listPendingInvites(): Promise<TeamInviteView[]> {
  return prisma.userInvite.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedById: true },
    orderBy: { createdAt: 'desc' },
  })
}

// ── Password reset ──────────────────────────────────────────────────────────

export type PasswordResetView = {
  id: string
  userId: string
  expiresAt: Date
  createdAt: Date
}

export async function requestPasswordReset(
  userId: string,
  actor?: { id: string; email: string; role: UserRole | string } | null
): Promise<{ reset: PasswordResetView; rawToken: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isActive: true },
  })
  if (!user) throw new Error('User not found.')
  if (!user.isActive) throw new Error('Cannot reset password for a disabled account.')

  // Delete any existing reset tokens for this user
  await prisma.passwordReset.deleteMany({ where: { userId } })

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS)

  const reset = await prisma.passwordReset.create({
    data: { userId, tokenHash, expiresAt },
    select: { id: true, userId: true, expiresAt: true, createdAt: true },
  })

  await recordAuditLogBestEffort({
    action: 'team.password_reset_requested',
    actor: actor ? { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role } : { actorType: 'SYSTEM' },
    resource: { type: 'User', id: userId },
    summary: `Password reset requested for ${user.email}`,
    redactions: ['tokenHash', 'rawToken'],
  })

  return { reset, rawToken }
}

export async function acceptPasswordReset(rawToken: string, newPassword: string): Promise<void> {
  const password = trimToNull(newPassword)
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  const candidates = await prisma.passwordReset.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { id: true, userId: true, tokenHash: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  let matched: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    if (await bcrypt.compare(rawToken, candidate.tokenHash)) {
      matched = candidate
      break
    }
  }

  if (!matched) throw new Error('Invalid or expired reset link.')

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.delete({ where: { id: matched!.id } })
    await tx.user.update({ where: { id: matched!.userId }, data: { passwordHash } })
    // Revoke all sessions so the new password is required to log back in
    await tx.session.deleteMany({ where: { userId: matched!.userId } })
  })

  await recordAuditLogBestEffort({
    action: 'team.password_reset_completed',
    actor: { actorType: 'SYSTEM' },
    resource: { type: 'User', id: matched.userId },
    summary: `Password reset completed for user ${matched.userId}`,
    redactions: ['tokenHash', 'rawToken', 'passwordHash'],
  })
}

// ── Session management ──────────────────────────────────────────────────────

export type SessionView = {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
}

export async function getUserSessions(userId: string): Promise<SessionView[]> {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function revokeUserSessions(
  userId: string,
  actor?: { id: string; email: string; role: UserRole | string } | null
): Promise<{ count: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!user) throw new Error('User not found.')

  const { count } = await prisma.session.deleteMany({ where: { userId } })

  await recordAuditLogBestEffort({
    action: 'team.sessions_revoked',
    actor: actor ? { actorType: 'STAFF', actorId: actor.id, actorEmail: actor.email, actorRole: actor.role } : { actorType: 'SYSTEM' },
    resource: { type: 'User', id: userId },
    summary: `${count} session(s) revoked for ${user.email}`,
    snapshot: { count },
  })

  return { count }
}
