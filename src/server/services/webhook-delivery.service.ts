import crypto from 'node:crypto'

import { Prisma } from '@prisma/client'
import type { WebhookDeliveryStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

function normalizeProviderEventId(providerEventId: string | undefined, payloadHash: string) {
  const normalized = String(providerEventId || '').trim()
  return normalized || `unknown:${payloadHash.slice(0, 24)}`
}

export async function getWebhookDeliveries(params: {
  provider?: string
  status?: WebhookDeliveryStatus
  eventType?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const {
    provider,
    status,
    eventType,
    search,
    page = 1,
    pageSize = 20,
  } = params
  const trimmedSearch = search?.trim()

  const where: Prisma.WebhookDeliveryWhereInput = {
    ...(provider ? { provider } : {}),
    ...(status ? { status } : {}),
    ...(eventType ? { eventType } : {}),
    ...(trimmedSearch
      ? {
          OR: [
            { providerEventId: { contains: trimmedSearch, mode: 'insensitive' } },
            { lastError: { contains: trimmedSearch, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.webhookDelivery.count({ where }),
  ])

  return {
    deliveries,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getWebhookDeliveryById(id: string) {
  return prisma.webhookDelivery.findUnique({
    where: { id },
  })
}

export function hashWebhookPayload(payload: string) {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

export async function recordWebhookDeliveryAttempt(input: {
  provider: string
  providerEventId?: string
  eventType?: string
  payload: string
}) {
  const payloadHash = hashWebhookPayload(input.payload)
  const providerEventId = normalizeProviderEventId(input.providerEventId, payloadHash)
  const eventType = String(input.eventType || 'unknown')

  return prisma.webhookDelivery.upsert({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId,
      },
    },
    create: {
      provider: input.provider,
      providerEventId,
      eventType,
      payloadHash,
      status: 'RECEIVED',
      attempts: 1,
    },
    update: {
      eventType,
      payloadHash,
      status: 'RECEIVED',
      attempts: { increment: 1 },
      lastError: null,
    },
  })
}

export async function markWebhookDeliveryProcessed(input: {
  provider: string
  providerEventId: string
}) {
  return prisma.webhookDelivery.update({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      lastError: null,
    },
  })
}

export async function markWebhookDeliveryFailed(input: {
  provider: string
  providerEventId: string
  status?: WebhookDeliveryStatus
  error: string
}) {
  return prisma.webhookDelivery.update({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    data: {
      status: input.status ?? 'FAILED',
      processedAt: null,
      lastError: input.error,
    },
  })
}
