import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getOrderShippingRatesForLabel } from '@/server/shipping/shipping-label.service'

interface Params {
  params: Promise<{ orderNumber: string }>
}

const schema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        variantId: z.string().min(1).optional(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, 'At least one item is required'),
  parcel: z.object({
    weightOz: z.number().positive(),
    lengthIn: z.number().positive(),
    widthIn: z.number().positive(),
    heightIn: z.number().positive(),
  }),
})

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params
  const parsedOrderNumber = Number.parseInt(orderNumber, 10)
  if (!Number.isFinite(parsedOrderNumber) || parsedOrderNumber <= 0) {
    return err('Invalid order number', 400)
  }

  const body = await parseBody(req)
  if (!body) return err('Invalid request body', 400)

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Order shipping-rate payload is invalid', parsed.error.flatten())
  }

  try {
    const rates = await getOrderShippingRatesForLabel({
      orderNumber: parsedOrderNumber,
      items: parsed.data.items,
      parcel: parsed.data.parcel,
    })

    return ok({
      provider: rates.provider,
      source: rates.source,
      currency: rates.currency,
      quotes: rates.quotes,
    })
  } catch (error) {
    console.error('[POST /api/orders/[orderNumber]/shipping-rates]', error)
    const message = error instanceof Error ? error.message : 'Failed to load shipping rates'
    return err(message, 400)
  }
}

