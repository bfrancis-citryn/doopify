import { NextResponse } from 'next/server'

import { AUTH_COOKIE } from '@/lib/auth'
import { getCookieValue } from '@/lib/cookies'

// ── Standard success response ──────────────────────────────────────────────────
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

// ── Standard error response ───────────────────────────────────────────────────
export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function unprocessable(message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status: 422 }
  )
}

// ── Parse JSON body safely ────────────────────────────────────────────────────
export async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

// ── Get token from cookie header ──────────────────────────────────────────────
export function getToken(req: Request): string | null {
  return getCookieValue(req.headers.get('cookie'), AUTH_COOKIE)
}
