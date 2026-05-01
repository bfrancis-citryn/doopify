import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  convertDraftOrder,
  DraftOrderConversionError,
} from '@/server/services/draft-order-conversion.service'

const lineItemSchema = z.object({
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  title: z.string().min(1),
  variantTitle: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
})

const schema = z.object({
  draftId: z.string().min(1),
  customerId: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentStatus: z.enum(['pending', 'paid']).optional(),
  shippingAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  shippingAddress: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
})

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body', 400)

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Draft conversion payload is invalid', parsed.error.flatten())
  }

  try {
    const result = await convertDraftOrder(parsed.data)
    return ok(result, result.duplicate ? 200 : 201)
  } catch (error) {
    if (error instanceof DraftOrderConversionError) {
      return err(
        error.message,
        error.code === 'INVALID_DRAFT'
          ? 400
          : error.code === 'DUPLICATE_CONVERSION'
            ? 409
            : 400
      )
    }

    console.error('[POST /api/draft-orders/convert]', error)
    return err('Failed to convert draft order', 500)
  }
}
