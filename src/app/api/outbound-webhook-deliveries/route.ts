import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize') || 20)))
    const status = searchParams.get('status')

    const where: any = {}
    if (status && status !== 'ALL') {
      where.status = status
    }

    const [total, deliveries] = await Promise.all([
      prisma.outboundWebhookDelivery.count({ where }),
      prisma.outboundWebhookDelivery.findMany({
        where,
        include: { integration: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
    ])

    return ok({
      deliveries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error: any) {
    return err(error.message, 500)
  }
}
