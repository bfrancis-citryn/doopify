import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from '@/server/services/order-identifier.service'
import { updateOrderNotes } from '@/server/services/order-notes.service'

interface Params {
  params: Promise<{ orderNumber: string }>
}

const schema = z
  .object({
    internalNote: z.string().max(5000).optional().nullable(),
    customerNote: z.string().max(5000).optional().nullable(),
    sendCustomerEmail: z.boolean().optional(),
  })
  .refine(
    (value) =>
      Object.prototype.hasOwnProperty.call(value, 'internalNote') ||
      Object.prototype.hasOwnProperty.call(value, 'customerNote'),
    'At least one note field must be provided'
  )

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body', 400)

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Order notes payload is invalid', parsed.error.flatten())
  }

  const { orderNumber } = await params

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)
    const result = await updateOrderNotes({
      orderId: resolvedOrder.orderId,
      internalNote: parsed.data.internalNote,
      customerNote: parsed.data.customerNote,
      sendCustomerEmail: parsed.data.sendCustomerEmail,
    })

    return ok(result)
  } catch (error) {
    if (error instanceof OrderIdentifierResolutionError) {
      return err(error.message, error.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    const message = error instanceof Error ? error.message : 'Failed to update order notes'
    return err(message, 400)
  }
}

