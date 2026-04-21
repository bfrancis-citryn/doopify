import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyToken } from '@/lib/auth'

const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth',
  '/api/storefront',
  '/api/webhooks',
  '/_next',
  '/favicon',
  '/images',
  '/public',
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isPublic) return NextResponse.next()

  if (!pathname.startsWith('/api/') && !isAdminPage(pathname)) {
    return NextResponse.next()
  }

  const token = req.cookies.get('doopify_token')?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = verifyToken(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('doopify_token')
    return res
  }

  const res = NextResponse.next()
  res.headers.set('x-user-id', payload.userId)
  res.headers.set('x-user-role', payload.role)
  res.headers.set('x-user-email', payload.email)
  return res
}

function isAdminPage(pathname: string) {
  const adminPaths = [
    '/orders',
    '/products',
    '/customers',
    '/discounts',
    '/analytics',
    '/settings',
    '/draft-orders',
    '/media',
  ]

  return adminPaths.some((prefix) => pathname.startsWith(prefix))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
