import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { consumeRateLimit } from '@/lib/rate-limit'
import { setAuthCookie } from '@/lib/auth'
import { loginUser } from '@/server/services/auth.service'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; password: string }>(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message)
  }

  const forwardedFor = req.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const emailKey = parsed.data.email.trim().toLowerCase()
  const rateLimit = await consumeRateLimit(`login:${ip}:${emailKey}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return err('Too many login attempts. Please try again later.', 429)
  }

  try {
    const { token, user } = await loginUser(parsed.data.email, parsed.data.password, {
      ip,
      userAgent: req.headers.get('user-agent'),
    })

    const res = ok({ user })
    setAuthCookie(res, token)
    return res
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Login failed'
    return err(message, 401)
  }
}
