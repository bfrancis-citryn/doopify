import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { deleteTaxRule, updateTaxRule } from '@/server/services/shipping-tax-config.service'

const updateTaxRuleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  countryCode: z.string().trim().min(2).max(3).optional(),
  provinceCode: z.string().trim().max(16).nullable().optional(),
  rate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
})

type RouteContext = {
  params: Promise<{
    ruleId: string
  }>
}

export async function PATCH(req: Request, context: RouteContext) {
  const { ruleId } = await context.params
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = updateTaxRuleSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Tax rule payload is invalid', parsed.error.flatten())
  }

  try {
    const updated = await updateTaxRule(ruleId, parsed.data)
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/tax-rules/[ruleId]]', error)
    const message = error instanceof Error ? error.message : 'Failed to update tax rule'
    return err(message, 400)
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { ruleId } = await context.params

  try {
    await deleteTaxRule(ruleId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/tax-rules/[ruleId]]', error)
    const message = error instanceof Error ? error.message : 'Failed to delete tax rule'
    return err(message, 400)
  }
}
