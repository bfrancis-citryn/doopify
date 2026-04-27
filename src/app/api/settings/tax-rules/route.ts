import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { createTaxRule, listTaxRules } from '@/server/services/shipping-tax-config.service'

const createTaxRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().min(2).max(3),
  provinceCode: z.string().trim().max(16).nullable().optional(),
  rate: z.number().min(0).max(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
})

export async function GET() {
  try {
    const rules = await listTaxRules()
    return ok(rules)
  } catch (error) {
    console.error('[GET /api/settings/tax-rules]', error)
    return err('Failed to load tax rules', 500)
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = createTaxRuleSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Tax rule payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createTaxRule(parsed.data)
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/tax-rules]', error)
    const message = error instanceof Error ? error.message : 'Failed to create tax rule'
    return err(message, 400)
  }
}
