import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/server/utils/crypto'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  webhookSecret: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  events: z.array(z.string()).optional(),
  secrets: z.array(z.object({
    key: z.string(),
    value: z.string().optional() // if value is blank, maybe delete it or leave alone
  })).optional()
})

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const integration = await prisma.integration.findUnique({
      where: { id },
      include: {
        events: true,
        secrets: { select: { id: true, key: true } }
      }
    })
    if (!integration) return err('Not found', 404)
    return ok(integration)
  } catch (error: any) {
    return err(error.message, 500)
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const json = await req.json()
    const parsed = updateSchema.parse(json)
    
    // We update in a transaction if we are mapping nested items
    const updated = await prisma.$transaction(async (tx) => {
      // update standard fields
      const data: any = {}
      if (parsed.name) data.name = parsed.name
      if (parsed.type) data.type = parsed.type
      if (parsed.status) data.status = parsed.status
      if (parsed.webhookUrl !== undefined) data.webhookUrl = parsed.webhookUrl || null
      if (parsed.webhookSecret !== undefined) {
        data.webhookSecret = parsed.webhookSecret ? encrypt(parsed.webhookSecret) : null
      }

      const integration = await tx.integration.update({
        where: { id },
        data
      })

      // Update events: delete old, create new
      if (parsed.events !== undefined) {
        await tx.integrationEvent.deleteMany({ where: { integrationId: id } })
        if (parsed.events.length > 0) {
          await tx.integrationEvent.createMany({
            data: parsed.events.map(event => ({ integrationId: id, event }))
          })
        }
      }

      // Update secrets:
      if (parsed.secrets !== undefined) {
        // delete secrets not in the new list?
        const newKeys = parsed.secrets.map(s => s.key)
        await tx.integrationSecret.deleteMany({
          where: { integrationId: id, key: { notIn: newKeys } }
        })

        // upsert existing or new ones
        for (const secret of parsed.secrets) {
          if (secret.value && secret.value.trim() !== '') {
            await tx.integrationSecret.upsert({
              where: { integrationId_key: { integrationId: id, key: secret.key } },
              create: { integrationId: id, key: secret.key, value: encrypt(secret.value) },
              update: { value: encrypt(secret.value) }
            })
          }
        }
      }

      return tx.integration.findUnique({
        where: { id },
        include: { events: true, secrets: { select: { id: true, key: true } } }
      })
    })

    return ok(updated)
  } catch (error: any) {
    console.error('Failed to update integration', error)
    return err(error.message, 400)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await prisma.integration.delete({ where: { id } })
    return ok({ success: true })
  } catch (error: any) {
    return err(error.message, 500)
  }
}
