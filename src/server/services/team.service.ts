import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const TEAM_MANAGEABLE_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'STAFF', 'VIEWER']

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
  if (!required) return // no token configured — open bootstrap
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

  return prisma.user.create({
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

  const invite = await prisma.userInvite.create({
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

  return prisma.$transaction(async (tx) => {
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
}

// ── Update user role ────────────────────────────────────────────────────────

export async function updateTeamUserRole(userId: string, newRole: UserRole) {
  if (!TEAM_MANAGEABLE_ROLES.includes(newRole)) {
    throw new Error('Invalid role.')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  })
  if (!user) throw new Error('User not found.')

  if (user.role === 'OWNER' && newRole !== 'OWNER') {
    await assertNotLastOwner(userId, 'demote this user from OWNER')
  }

  return prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  })
}

// ── Disable user ────────────────────────────────────────────────────────────

export async function disableTeamUser(userId: string) {
  await assertNotLastOwner(userId, 'disable this user')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new Error('User not found.')

  // Invalidate all sessions immediately
  await prisma.session.deleteMany({ where: { userId } })

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { id: true, email: true, role: true, isActive: true },
  })
}

// ── Reactivate user ─────────────────────────────────────────────────────────

export async function reactivateTeamUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new Error('User not found.')

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    select: { id: true, email: true, role: true, isActive: true },
  })
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
