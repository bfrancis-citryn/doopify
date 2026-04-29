import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { z } from 'zod'

export const runtime = 'nodejs'

const statusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'EXHAUSTED', 'ALL'])

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize') || 20)))
    const parsedStatus = statusSchema.safeParse(searchParams.get('status') || 'ALL')
    if (!parsedStatus.success) return err('Invalid outbound webhook delivery status', 400)

    const where = parsedStatus.data === 'ALL' ? {} : { status: parsedStatus.data }

    const [total, deliveries] = await Promise.all([
      prisma.outboundWebhookDelivery.count({ where }),
      prisma.outboundWebhookDelivery.findMany({
        where,
        include: {
          integration: { select: { id: true, name: true, status: true, webhookUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok({
      deliveries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('[GET /api/outbound-webhook-deliveries]', error)
    return err('Failed to fetch outbound webhook deliveries', 500)
  }
}
