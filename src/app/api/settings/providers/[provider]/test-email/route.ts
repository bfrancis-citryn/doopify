import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import {
  parseSupportedProvider,
  sendProviderTestEmail,
} from '@/server/services/provider-connection.service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ provider: string }>
}

const schema = z.object({
  toEmail: z.string().email(),
  fromEmail: z.string().email().optional().nullable(),
})

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { provider: providerParam } = await context.params
  const provider = parseSupportedProvider(providerParam)
  if (!provider) {
    return err('Unsupported provider', 404)
  }

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Provider test email payload is invalid', parsed.error.flatten())
  }

  try {
    const result = await sendProviderTestEmail({
      provider,
      toEmail: parsed.data.toEmail,
      fromEmail: parsed.data.fromEmail,
    })

    return ok({ provider, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send provider test email'
    console.error('[POST /api/settings/providers/[provider]/test-email]', message)
    return err(message, 400)
  }
}
