import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { getStoreSettings, updateStoreSettings } from '@/server/services/settings.service'

export async function GET() {
  try {
    const store = await getStoreSettings()
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
  logoUrl: z.union([z.string().url(), z.literal('')]).optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  address1: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  shippingThreshold: z.number().optional(),
  shippingDomesticRate: z.number().min(0).optional(),
  shippingInternationalRate: z.number().min(0).optional(),
  domesticTaxRate: z.number().min(0).max(1).optional(),
  internationalTaxRate: z.number().min(0).max(1).optional(),
})

export async function PATCH(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const store = await getStoreSettings()
    if (!store) return err('Store not found', 404)

    const updated = await updateStoreSettings(store.id, {
      ...parsed.data,
      logoUrl: parsed.data.logoUrl || undefined,
    })
    return ok(updated)
  } catch (e) {
    console.error('[PATCH /api/settings]', e)
    return err('Failed to update settings', 500)
  }
}
