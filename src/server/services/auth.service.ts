import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, AUTH_COOKIE } from '@/lib/auth'
import type { UserRole } from '@prisma/client'
import { getCookieValue } from '@/lib/cookies'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function loginUser(
  email: string,
  password: string,
  context?: { ip?: string | null; userAgent?: string | null }
) {
  const normalizedEmail = normalizeEmail(email)
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (!user || !user.isActive) {
    throw new Error('Invalid email or password')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new Error('Invalid email or password')
  }

  // Create a persistent session record
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Sign with a temporary sessionId placeholder first, then update
  const tempToken = signToken({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    sessionId: 'pending',
  })

  const session = await prisma.session.create({
    data: {
      token: tempToken,
      userId: user.id,
      expiresAt,
      ip: context?.ip ?? undefined,
      userAgent: context?.userAgent ?? undefined,
    },
  })

  // Sign the real token with the actual sessionId
  const token = signToken({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    sessionId: session.id,
  })

  // Update the session record with the final token
  await prisma.session.update({
    where: { id: session.id },
    data: { token },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logoutUser(token: string) {
  await prisma.session.deleteMany({ where: { token } })
}

// ── Create admin user (used in seed) ─────────────────────────────────────────
export async function createUser(data: {
  email: string
  password: string
  firstName?: string
  lastName?: string
  role?: UserRole
}) {
  const passwordHash = await bcrypt.hash(data.password, 12)

  return prisma.user.create({
    data: {
      email: normalizeEmail(data.email),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role ?? 'STAFF',
    },
  })
}

// ── Get token from request cookies ───────────────────────────────────────────
export function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  return getCookieValue(cookieHeader, AUTH_COOKIE)
}
