import type { UserRole } from '@prisma/client'
import jwt from 'jsonwebtoken'
import type { NextResponse } from 'next/server'

import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET!

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in environment variables')
}

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

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function getSessionUser(token: string) {
  const payload = verifyToken(token)
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
    secure: process.env.NODE_ENV === 'production',
  }
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, getAuthCookieOptions())
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, '', getAuthCookieOptions(0))
}
