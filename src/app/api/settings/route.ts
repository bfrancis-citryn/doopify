import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { prisma } from '@/lib/prisma'

async function getStore() {
  return prisma.store.findFirst()
}

export async function GET() {
  try {
    const store = await getStore()
    if (!store) return err('Store not configured', 404)
    return ok(store)
  } catch (e) {
    console.error('[GET /api/settings]', e)
    return err('Failed to fetch settings', 500)
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  domain: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  address1: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  shippingThreshold: z.number().optional(),
})

export async function PATCH(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const store = await getStore()
    if (!store) return err('Store not found', 404)

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: parsed.data,
    })
    return ok(updated)
  } catch (e) {
    console.error('[PATCH /api/settings]', e)
    return err('Failed to update settings', 500)
  }
}
