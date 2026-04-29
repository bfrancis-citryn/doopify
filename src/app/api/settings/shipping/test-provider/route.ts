import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { testShippingProviderConnection } from '@/server/shipping/shipping-provider.service'

export const runtime = 'nodejs'

const testProviderSchema = z.object({
  provider: z.enum(['EASYPOST', 'SHIPPO']),
})

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = testProviderSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping provider payload is invalid', parsed.error.flatten())
  }

  try {
    const result = await testShippingProviderConnection(parsed.data.provider)
    return ok(result)
  } catch (error) {
    console.error('[POST /api/settings/shipping/test-provider]', error)
    const message = error instanceof Error ? error.message : 'Failed to test provider'
    return err(message, 500)
  }
}
