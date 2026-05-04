import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  addCustomerAddress,
  createCustomer,
  getCustomer,
  getCustomers,
} from '@/server/services/customer.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

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
  shippingAddress: z.string().optional(),
  billingAddress: z.string().optional(),
})

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const customer = await createCustomer({
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      acceptsMarketing: parsed.data.acceptsMarketing,
      tags: parsed.data.tags,
      note: parsed.data.note,
    })

    const shippingAddress = parsed.data.shippingAddress?.trim()
    const billingAddress = parsed.data.billingAddress?.trim()

    if (shippingAddress) {
      await addCustomerAddress(customer.id, {
        address1: shippingAddress,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        isDefault: true,
      })
    }

    if (billingAddress) {
      await addCustomerAddress(customer.id, {
        address1: billingAddress,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        isDefault: !shippingAddress,
      })
    }

    const enrichedCustomer = await getCustomer(customer.id)
    return ok(enrichedCustomer || customer, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'A customer with this email already exists'
      : 'Failed to create customer'
    return err(msg, 500)
  }
}
