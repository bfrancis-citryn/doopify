import crypto from 'crypto'

import { prisma } from '@/lib/prisma'
import { decrypt } from '@/server/utils/crypto'
import type { DoopifyEventName, DoopifyEvents } from '@/server/events/types'
import type { OutboundWebhookDelivery } from '@prisma/client'

const MAX_ATTEMPTS = 5
const MAX_RESPONSE_BODY_LENGTH = 1000
const RETRYABLE_STATUSES = ['PENDING', 'RETRYING', 'FAILED', 'EXHAUSTED'] as const

function calculateNextRetry(attempt: number, now = new Date()): Date {
  const baseDelayMs = 1000 * 60
  const delay = baseDelayMs * Math.pow(3, Math.max(0, attempt - 1))
  return new Date(now.getTime() + delay)
}

export function createOutboundWebhookSignature(input: {
  payload: string
  secret: string
  timestamp: string | number
}) {
  return `sha256=${crypto
    .createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.payload}`)
    .digest('hex')}`
}

function safeResponseBody(body: string) {
  return body.slice(0, MAX_RESPONSE_BODY_LENGTH)
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Outbound webhook delivery failed'
}

function uniqueEvents(events: string[] | undefined) {
  return [...new Set((events ?? []).map((event) => event.trim()).filter(Boolean))]
}

export async function queueOutboundWebhooks<K extends DoopifyEventName>(
  event: K,
  payload: DoopifyEvents[K]
) {
  const activeIntegrations = await prisma.integration.findMany({
    where: {
      status: 'ACTIVE',
      webhookUrl: { not: null },
      events: {
        some: { event },
      },
    },
    select: { id: true },
  })

  if (!activeIntegrations.length) {
    return { queued: 0 }
  }

  const payloadString = JSON.stringify({
    event,
    data: payload,
    createdAt: new Date().toISOString(),
  })

  await prisma.outboundWebhookDelivery.createMany({
    data: activeIntegrations.map((integration) => ({
      integrationId: integration.id,
      event,
      payload: payloadString,
      status: 'PENDING',
    })),
  })

  return { queued: activeIntegrations.length }
}

async function claimOutboundDelivery(delivery: Pick<OutboundWebhookDelivery, 'id' | 'status' | 'nextRetryAt'>, now: Date) {
  if (delivery.status === 'PENDING') {
    return prisma.outboundWebhookDelivery.updateMany({
      where: { id: delivery.id, status: 'PENDING' },
      data: { status: 'RETRYING', lastRetriedAt: now },
    })
  }

  if (delivery.status === 'RETRYING') {
    return prisma.outboundWebhookDelivery.updateMany({
      where: {
        id: delivery.id,
        status: 'RETRYING',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      data: { lastRetriedAt: now },
    })
  }

  return { count: 0 }
}

export async function processOutboundWebhook(deliveryId: string) {
  const delivery = await prisma.outboundWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { integration: { include: { secrets: true } } },
  })

  if (!delivery || !delivery.integration || (delivery.status !== 'PENDING' && delivery.status !== 'RETRYING')) {
    return null
  }

  const attemptedAt = new Date()
  const claimed = await claimOutboundDelivery(delivery, attemptedAt)
  if (claimed.count === 0) return null

  const integration = delivery.integration
  if (!integration.webhookUrl || integration.status !== 'ACTIVE') {
    return prisma.outboundWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'EXHAUSTED',
        lastError: integration.status !== 'ACTIVE'
          ? 'Integration is inactive'
          : 'Missing webhook URL on integration',
        processedAt: new Date(),
        nextRetryAt: null,
      },
    })
  }

  const newAttempts = delivery.attempts + 1
  let status: OutboundWebhookDelivery['status'] = 'SUCCESS'
  let lastError: string | null = null
  let statusCode: number | null = null
  let responseBody: string | null = null

  try {
    const timestamp = Math.floor(attemptedAt.getTime() / 1000)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Doopify-Webhook-Dispatcher/1.0',
      'X-Doopify-Delivery': delivery.id,
      'X-Doopify-Event': delivery.event,
      'X-Doopify-Timestamp': String(timestamp),
    }

    if (integration.webhookSecret) {
      const decryptedSecret = decrypt(integration.webhookSecret)
      headers['X-Doopify-Signature'] = createOutboundWebhookSignature({
        payload: delivery.payload,
        secret: decryptedSecret,
        timestamp,
      })
    }

    for (const secret of integration.secrets) {
      if (secret.key.startsWith('HEADER_')) {
        const headerName = secret.key.substring('HEADER_'.length).trim()
        if (headerName) {
          headers[headerName] = decrypt(secret.value)
        }
      }
    }

    const response = await fetch(integration.webhookUrl, {
      method: 'POST',
      headers,
      body: delivery.payload,
      cache: 'no-store',
    })

    statusCode = response.status
    responseBody = safeResponseBody(await response.text())

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`)
    }
  } catch (error) {
    lastError = normalizeError(error)
    status = newAttempts >= MAX_ATTEMPTS ? 'EXHAUSTED' : 'RETRYING'
  }

  return prisma.outboundWebhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      attempts: newAttempts,
      statusCode,
      responseBody,
      lastError,
      lastRetriedAt: attemptedAt,
      processedAt: status === 'SUCCESS' || status === 'EXHAUSTED' ? new Date() : null,
      nextRetryAt: status === 'RETRYING' ? calculateNextRetry(newAttempts, attemptedAt) : null,
    },
  })
}

export async function processDueOutboundDeliveries(limit = 50) {
  const dueDeliveries = await prisma.outboundWebhookDelivery.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'RETRYING', nextRetryAt: { lte: new Date() } },
      ],
    },
    take: Math.max(1, Math.min(100, limit)),
    orderBy: { createdAt: 'asc' },
  })

  const results = await Promise.allSettled(
    dueDeliveries.map((delivery) => processOutboundWebhook(delivery.id))
  )

  return {
    processed: results.length,
    success: results.filter((result) => result.status === 'fulfilled').length,
    failures: results.filter((result) => result.status === 'rejected').length,
  }
}

export async function retryOutboundWebhookDelivery(deliveryId: string) {
  const existing = await prisma.outboundWebhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true },
  })

  if (!existing || !RETRYABLE_STATUSES.includes(existing.status as typeof RETRYABLE_STATUSES[number])) {
    return null
  }

  const delivery = await prisma.outboundWebhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'PENDING',
      nextRetryAt: null,
      processedAt: null,
      lastError: null,
    },
  })

  return processOutboundWebhook(delivery.id)
}

export { uniqueEvents }
