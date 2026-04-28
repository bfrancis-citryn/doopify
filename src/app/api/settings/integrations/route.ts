import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/server/utils/crypto'
import { z } from 'zod'

export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  webhookSecret: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  events: z.array(z.string()).optional(),
  secrets: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional()
})

export async function GET() {
  try {
    const integrations = await prisma.integration.findMany({
      include: {
        events: true,
        // we deliberately do not send down the secrets unencrypted list,
        // or we just send the keys so the UI knows they exist
        secrets: {
          select: { id: true, key: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(integrations)
  } catch (error: any) {
    console.error('Failed to get integrations', error)
    return err(error.message, 500)
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = createSchema.parse(json)

    const integration = await prisma.integration.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        webhookUrl: parsed.webhookUrl || null,
        webhookSecret: parsed.webhookSecret ? encrypt(parsed.webhookSecret) : null,
        status: parsed.status,
        events: parsed.events?.length ? {
          create: parsed.events.map(event => ({ event }))
        } : undefined,
        secrets: parsed.secrets?.length ? {
          create: parsed.secrets.filter(s => !!s.value).map(s => ({
            key: s.key,
            value: encrypt(s.value)
          }))
        } : undefined
      },
      include: { events: true, secrets: { select: { id: true, key: true } } }
    })

    return ok(integration)
  } catch (error: any) {
    console.error('Failed to create integration', error)
    return err(error.message, 400)
  }
}
