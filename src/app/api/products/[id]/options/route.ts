import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { upsertOptions } from '@/server/services/product.service'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  options: z.array(
    z.object({
      name: z.string().min(1),
      position: z.number().int().optional(),
      values: z.array(
        z.object({
          value: z.string().min(1),
          position: z.number().int().optional(),
        })
      ).min(1, 'Each option must have at least one value'),
    })
  ).min(1),
})

// PUT replaces all options for a product atomically
export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id: productId } = await params
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const product = await upsertOptions(productId, parsed.data.options)
    return ok(product)
  } catch (e) {
    console.error('[PUT /api/products/[id]/options]', e)
    return err('Failed to update options', 500)
  }
}
