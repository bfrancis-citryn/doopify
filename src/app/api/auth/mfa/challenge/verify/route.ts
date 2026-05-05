import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { consumeRateLimit } from '@/lib/rate-limit'
import { setAuthCookie } from '@/lib/auth'
import { createSessionForUser } from '@/server/services/auth.service'
import { verifyOwnerMfaLoginChallenge } from '@/server/services/mfa.service'

export const runtime = 'nodejs'

const schema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(6).max(64),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const forwardedFor = req.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

  const rateLimit = await consumeRateLimit(`mfa-challenge:${ip}:${parsed.data.challengeId}`, {
    limit: 8,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return err('Too many MFA attempts. Please try again later.', 429)
  }

  try {
    const verified = await verifyOwnerMfaLoginChallenge(parsed.data.challengeId, parsed.data.code)
    const session = await createSessionForUser(verified.user, {
      ip,
      userAgent: req.headers.get('user-agent'),
    })

    const res = ok({
      user: session.user,
      usedRecoveryCode: verified.usedRecoveryCode,
      recoveryCodesRemaining: verified.recoveryCodesRemaining,
    })
    setAuthCookie(res, session.token)
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MFA verification failed'
    return err(message, 401)
  }
}
