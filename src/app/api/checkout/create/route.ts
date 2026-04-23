import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { createCheckoutPaymentIntent } from '@/server/services/checkout.service'

const itemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
})

const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(2),
  phone: z.string().optional(),
})

const schema = z.object({
  email: z.string().email(),
  items: z.array(itemSchema).min(1),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Checkout payload is invalid', parsed.error.flatten())
  }

  try {
    const checkout = await createCheckoutPaymentIntent(parsed.data)
    return ok(checkout, 201)
  } catch (error) {
    console.error('[POST /api/checkout/create]', error)
    const message = error instanceof Error ? error.message : 'Failed to create checkout payment intent'
    return err(message, 400)
  }
}
