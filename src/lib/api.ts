import { NextResponse } from 'next/server'

// ── Standard success response ──────────────────────────────────────────────────
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

// ── Standard error response ───────────────────────────────────────────────────
export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
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
  const cookie = req.headers.get('cookie') ?? ''
  const match = cookie.match(/doopify_token=([^;]+)/)
  return match ? match[1] : null
}
