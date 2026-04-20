import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

const updateSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['ACTIVE', 'SCHEDULED', 'EXPIRED', 'DISABLED']).optional(),
  value: z.number().min(0).optional(),
  minimumOrder: z.number().optional(),
  usageLimit: z.number().int().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const discount = await prisma.discount.update({
      where: { id },
      data: {
        ...parsed.data,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      },
    })
    return ok(discount)
  } catch (e) {
    console.error('[PATCH /api/discounts/[id]]', e)
    return err('Failed to update discount', 500)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    await prisma.discount.update({ where: { id }, data: { status: 'DISABLED' } })
    return ok({ message: 'Discount disabled' })
  } catch (e) {
    console.error('[DELETE /api/discounts/[id]]', e)
    return err('Failed to disable discount', 500)
  }
}
