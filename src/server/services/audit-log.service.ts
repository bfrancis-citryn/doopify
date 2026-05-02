import type { Prisma, UserRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export type AuditActor = {
  actorType?: 'SYSTEM' | 'STAFF' | 'CUSTOMER'
  actorId?: string | null
  actorEmail?: string | null
  actorRole?: UserRole | string | null
}

export type AuditLogInput = {
  action: string
  actor?: AuditActor | null
  resource: {
    type: string
    id: string
  }
  summary: string
  diff?: Prisma.InputJsonValue | null
  snapshot?: Prisma.InputJsonValue | null
  redactions?: string[]
  occurredAt?: Date
}

const REDACTED = '[REDACTED]'

const SENSITIVE_KEY_PATTERN =
  /(secret|password|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization|credential|html|rawpayload|rawresponse|body)/i

function auditEventClient() {
  return (prisma as any).analyticsEvent
}

export function auditActorFromUser(user: {
  id: string
  email: string
  role: UserRole | string
}): AuditActor {
  return {
    actorType: user.role === 'VIEWER' ? 'STAFF' : 'STAFF',
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
  }
}

export function redactAuditPayload<T>(value: T): T {
  if (value == null) return value

  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditPayload(item)) as T
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactAuditPayload(entry),
      ])
    ) as T
  }

  return value
}

export async function recordAuditLog(input: AuditLogInput) {
  const actor = input.actor ?? { actorType: 'SYSTEM' as const }
  const occurredAt = input.occurredAt ?? new Date()
  const snapshot = redactAuditPayload(input.snapshot ?? null)
  const diff = redactAuditPayload(input.diff ?? null)

  return auditEventClient().create({
    data: {
      event: `audit.${input.action}`,
      occurredAt,
      payload: {
        audit: true,
        action: input.action,
        actor: {
          actorType: actor.actorType ?? 'SYSTEM',
          actorId: actor.actorId ?? null,
          actorEmail: actor.actorEmail ?? null,
          actorRole: actor.actorRole ?? null,
        },
        resource: input.resource,
        summary: input.summary,
        diff,
        snapshot,
        redactions: input.redactions ?? [],
      },
      deliveryId: input.resource.type === 'EmailDelivery' ? input.resource.id : null,
    },
  })
}

export async function recordAuditLogBestEffort(input: AuditLogInput) {
  try {
    return await recordAuditLog(input)
  } catch (error) {
    console.error('[audit-log] Failed to record audit event', {
      action: input.action,
      resource: input.resource,
      error,
    })
    return null
  }
}
