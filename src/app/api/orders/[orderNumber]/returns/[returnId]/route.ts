import { z } from 'zod'

import { err, getToken, ok, parseBody } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { updateReturnStatus } from '@/server/services/return.service'

interface Params { params: Promise<{ orderNumber: string; returnId: string }> }

const updateReturnSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED', 'IN_TRANSIT', 'RECEIVED', 'CLOSED']),
  note: z.string().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const token = getToken(req)
  if (!token || !(await verifyToken(token))) return err('Unauthorized', 401)

  const { returnId } = await params

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateReturnSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const updated = await updateReturnStatus(returnId, parsed.data)
    return ok(updated)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update return'
    console.error('[PATCH /api/orders/[orderNumber]/returns/[returnId]]', e)
    return err(message, 400)
  }
}
