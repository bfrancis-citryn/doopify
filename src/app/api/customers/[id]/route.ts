import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { getCustomer, updateCustomer } from '@/server/services/customer.service'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    const customer = await getCustomer(id)
    if (!customer) return err('Customer not found', 404)
    return ok(customer)
  } catch (e) {
    console.error('[GET /api/customers/[id]]', e)
    return err('Failed to fetch customer', 500)
  }
}

const updateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  acceptsMarketing: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const customer = await updateCustomer(id, parsed.data)
    return ok(customer)
  } catch (e) {
    console.error('[PATCH /api/customers/[id]]', e)
    return err('Failed to update customer', 500)
  }
}
