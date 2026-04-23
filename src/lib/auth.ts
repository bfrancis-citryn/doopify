import type { UserRole } from '@prisma/client'
import jwt from 'jsonwebtoken'
import type { NextResponse } from 'next/server'

import { getCookieValue } from '@/lib/cookies'
import { env } from '@/lib/env'
import { prisma } from './prisma'

const JWT_SECRET = env.JWT_SECRET

export interface JWTPayload {
  userId: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role: UserRole
  sessionId: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const payload = decodeToken(token)
  if (!payload) return null

  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      },
    },
  })

  if (!session) {
    return null
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { token } })
    return null
  }

  if (!session.user.isActive || session.user.id !== payload.userId || session.user.email !== payload.email) {
    return null
  }

  return payload
}

export async function getSessionUser(token: string) {
  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  })

  if (!user || !user.isActive) return null
  return user
}

export const AUTH_COOKIE = 'doopify_token'

function getAuthCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'strict' as const,
    secure: env.NODE_ENV === 'production',
  }
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, getAuthCookieOptions())
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, '', getAuthCookieOptions(0))
}

export function getAuthTokenFromCookieHeader(cookieHeader: string | null) {
  return getCookieValue(cookieHeader, AUTH_COOKIE)
}
