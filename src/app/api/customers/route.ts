import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { getCustomers, createCustomer } from '@/server/services/customer.service'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getCustomers({
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 20),
    })
    return ok(result)
  } catch (e) {
    console.error('[GET /api/customers]', e)
    return err('Failed to fetch customers', 500)
  }
}

const createSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  acceptsMarketing: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const customer = await createCustomer(parsed.data)
    return ok(customer, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'A customer with this email already exists'
      : 'Failed to create customer'
    return err(msg, 500)
  }
}
