import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { dollarsToCents, formatCents } from '@/lib/money'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  code: z.string().min(1),
  orderTotal: z.number().min(0),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const discount = await prisma.discount.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
    })

    if (!discount) return err('Discount code not found', 404)
    if (discount.status !== 'ACTIVE') return err('This discount code is not active', 400)

    const now = new Date()
    if (discount.startsAt && discount.startsAt > now) return err('This discount code is not yet valid', 400)
    if (discount.endsAt && discount.endsAt < now) return err('This discount code has expired', 400)
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return err('This discount code has reached its usage limit', 400)
    }

    const orderTotalCents = dollarsToCents(parsed.data.orderTotal)
    if (discount.minimumOrderCents && orderTotalCents < discount.minimumOrderCents) {
      return err(`Minimum order of ${formatCents(discount.minimumOrderCents)} required`, 400)
    }

    return ok({ discount, valid: true })
  } catch (e) {
    console.error('[POST /api/discounts/validate]', e)
    return err('Failed to validate discount', 500)
  }
}
