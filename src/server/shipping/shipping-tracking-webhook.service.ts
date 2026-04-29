import crypto from 'node:crypto'

import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { queueShippingTrackingSyncJob } from '@/server/shipping/shipping-tracking-jobs.service'

export type ShippingWebhookProvider = 'EASYPOST' | 'SHIPPO'

export type ShippingProviderTrackingWebhookEvent = {
  provider: ShippingWebhookProvider
  providerEventId?: string
  eventType: string
  providerStatus: string
  lifecycleStatus: 'PRE_TRANSIT' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILURE' | 'UNKNOWN'
  deliveredAt?: string
  providerLabelId?: string
  providerShipmentId?: string
  trackingNumber?: string
  trackingUrl?: string
}

export type ApplyShippingProviderWebhookEventResult = {
  handled: boolean
  reason?:
    | 'UNSUPPORTED_EVENT'
    | 'MISSING_TRACKING_REFERENCE'
    | 'DELIVERY_NOT_FOUND'
    | 'MISSING_FULFILLMENT'
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? '')
    .trim()
    .toUpperCase()

  if (!status) return { providerStatus: 'unknown', lifecycleStatus: 'UNKNOWN' as const }
  if (status.includes('DELIVER')) return { providerStatus: status, lifecycleStatus: 'DELIVERED' as const }
  if (status.includes('TRANSIT')) return { providerStatus: status, lifecycleStatus: 'IN_TRANSIT' as const }
  if (status.includes('PRE_TRANSIT') || status.includes('LABEL')) {
    return { providerStatus: status, lifecycleStatus: 'PRE_TRANSIT' as const }
  }
  if (status.includes('FAIL') || status.includes('RETURN') || status.includes('EXCEPTION')) {
    return { providerStatus: status, lifecycleStatus: 'FAILURE' as const }
  }

  return { providerStatus: status, lifecycleStatus: 'UNKNOWN' as const }
}

function isShippoSignatureValid(signature: string, secret: string, payload: string) {
  const normalized = signature.trim()
  if (!normalized) return false

  if (normalized === secret) {
    return true
  }

  const hmacHex = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  if (normalized === hmacHex || normalized === `sha256=${hmacHex}`) {
    return true
  }

  const entries = normalized.split(',').map((part) => part.trim())
  const versionEntry = entries.find((entry) => entry.startsWith('v1='))
  if (!versionEntry) {
    return false
  }

  const providedV1 = versionEntry.slice(3)
  if (!providedV1) {
    return false
  }

  const timestampEntry = entries.find((entry) => entry.startsWith('t='))
  if (timestampEntry) {
    const timestamp = timestampEntry.slice(2)
    if (timestamp) {
      const withTimestamp = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`, 'utf8')
        .digest('hex')
      if (providedV1 === withTimestamp) {
        return true
      }
    }
  }

  return providedV1 === hmacHex
}

function isEasyPostSignatureValid(signature: string, secret: string, payload: string) {
  const normalized = signature.trim()
  if (!normalized) return false

  const digest = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  return normalized === digest || normalized === `sha256=${digest}` || normalized === secret
}

export function verifyShippingProviderWebhookSignature(input: {
  provider: ShippingWebhookProvider
  payload: string
  headers: Headers
}) {
  if (input.provider === 'EASYPOST') {
    const secret = env.EASYPOST_WEBHOOK_SECRET
    if (!secret) {
      throw new Error('EASYPOST_WEBHOOK_SECRET is not configured')
    }

    const signature =
      input.headers.get('x-hmac-signature') ||
      input.headers.get('x-easypost-signature') ||
      input.headers.get('x-doopify-shipping-signature')
    if (!signature) {
      throw new Error('Missing EasyPost webhook signature header')
    }

    if (!isEasyPostSignatureValid(signature, secret, input.payload)) {
      throw new Error('EasyPost webhook signature verification failed')
    }
    return
  }

  const secret = env.SHIPPO_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('SHIPPO_WEBHOOK_SECRET is not configured')
  }

  const signature = input.headers.get('shippo-signature') || input.headers.get('x-doopify-shipping-signature')
  if (!signature) {
    throw new Error('Missing Shippo webhook signature header')
  }

  if (!isShippoSignatureValid(signature, secret, input.payload)) {
    throw new Error('Shippo webhook signature verification failed')
  }
}

function parseEasyPostTrackingWebhook(payload: Record<string, unknown>): ShippingProviderTrackingWebhookEvent {
  const result = (payload.result as Record<string, unknown> | undefined) ?? payload
  const statusInfo = normalizeStatus(result.status ?? payload.status)

  return {
    provider: 'EASYPOST',
    providerEventId:
      typeof payload.id === 'string'
        ? payload.id
        : typeof result.id === 'string'
          ? result.id
          : undefined,
    eventType:
      typeof payload.description === 'string'
        ? payload.description
        : typeof payload.object === 'string'
          ? payload.object
          : 'tracker.updated',
    providerStatus: statusInfo.providerStatus,
    lifecycleStatus: statusInfo.lifecycleStatus,
    deliveredAt:
      statusInfo.lifecycleStatus === 'DELIVERED'
        ? typeof result.updated_at === 'string'
          ? result.updated_at
          : typeof payload.updated_at === 'string'
            ? payload.updated_at
            : undefined
        : undefined,
    providerLabelId:
      typeof result.id === 'string'
        ? result.id
        : typeof payload.tracker_id === 'string'
          ? payload.tracker_id
          : undefined,
    providerShipmentId:
      typeof payload.previous_attributes === 'object' &&
      payload.previous_attributes &&
      typeof (payload.previous_attributes as Record<string, unknown>).shipment_id === 'string'
        ? ((payload.previous_attributes as Record<string, unknown>).shipment_id as string)
        : undefined,
    trackingNumber:
      typeof result.tracking_code === 'string'
        ? result.tracking_code
        : typeof payload.tracking_code === 'string'
          ? payload.tracking_code
          : undefined,
    trackingUrl:
      typeof result.public_url === 'string'
        ? result.public_url
        : typeof payload.tracking_url === 'string'
          ? payload.tracking_url
          : undefined,
  }
}

function parseShippoTrackingWebhook(payload: Record<string, unknown>): ShippingProviderTrackingWebhookEvent {
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload
  const trackingStatus = data.tracking_status as Record<string, unknown> | undefined
  const statusInfo = normalizeStatus(trackingStatus?.status ?? data.status ?? payload.event)

  return {
    provider: 'SHIPPO',
    providerEventId:
      typeof payload.event_id === 'string'
        ? payload.event_id
        : typeof payload.object_id === 'string'
          ? payload.object_id
          : typeof data.object_id === 'string'
            ? data.object_id
            : undefined,
    eventType:
      typeof payload.event === 'string'
        ? payload.event
        : typeof payload.object_state === 'string'
          ? payload.object_state
          : 'track_updated',
    providerStatus: statusInfo.providerStatus,
    lifecycleStatus: statusInfo.lifecycleStatus,
    deliveredAt:
      statusInfo.lifecycleStatus === 'DELIVERED' && typeof trackingStatus?.status_date === 'string'
        ? trackingStatus.status_date
        : undefined,
    providerLabelId:
      typeof payload.transaction === 'string'
        ? payload.transaction
        : typeof data.transaction === 'string'
          ? data.transaction
          : undefined,
    providerShipmentId:
      typeof payload.shipment === 'string'
        ? payload.shipment
        : typeof data.shipment === 'string'
          ? data.shipment
          : undefined,
    trackingNumber:
      typeof data.tracking_number === 'string'
        ? data.tracking_number
        : typeof payload.tracking_number === 'string'
          ? payload.tracking_number
          : undefined,
    trackingUrl:
      typeof data.tracking_url_provider === 'string'
        ? data.tracking_url_provider
        : typeof payload.tracking_url === 'string'
          ? payload.tracking_url
          : undefined,
  }
}

export function parseShippingProviderWebhookPayload(input: {
  provider: ShippingWebhookProvider
  payload: string
}): ShippingProviderTrackingWebhookEvent | null {
  try {
    const parsed = JSON.parse(input.payload)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const payload = parsed as Record<string, unknown>
    if (input.provider === 'EASYPOST') {
      return parseEasyPostTrackingWebhook(payload)
    }

    return parseShippoTrackingWebhook(payload)
  } catch {
    return null
  }
}

function parseDeliveredAt(value: string | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function applyShippingProviderTrackingWebhookEvent(
  event: ShippingProviderTrackingWebhookEvent
): Promise<ApplyShippingProviderWebhookEventResult> {
  const trackingNumber = String(event.trackingNumber ?? '').trim()
  const providerLabelId = String(event.providerLabelId ?? '').trim()
  const providerShipmentId = String(event.providerShipmentId ?? '').trim()

  if (!trackingNumber && !providerLabelId && !providerShipmentId) {
    return {
      handled: false,
      reason: 'MISSING_TRACKING_REFERENCE',
    }
  }

  const shippingLabel = await prisma.shippingLabel.findFirst({
    where: {
      provider: event.provider,
      OR: [
        ...(providerLabelId ? [{ providerLabelId }] : []),
        ...(providerShipmentId ? [{ providerShipmentId }] : []),
        ...(trackingNumber ? [{ trackingNumber }] : []),
      ],
    },
    include: {
      fulfillment: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!shippingLabel) {
    return {
      handled: false,
      reason: 'DELIVERY_NOT_FOUND',
    }
  }

  if (!shippingLabel.fulfillmentId || !shippingLabel.fulfillment) {
    return {
      handled: false,
      reason: 'MISSING_FULFILLMENT',
    }
  }

  const fulfillment = shippingLabel.fulfillment
  const shouldMarkDelivered = event.lifecycleStatus === 'DELIVERED' && !fulfillment.deliveredAt
  const deliveredAt = parseDeliveredAt(event.deliveredAt) ?? new Date()
  const resolvedTrackingNumber = trackingNumber || fulfillment.trackingNumber || shippingLabel.trackingNumber
  const resolvedTrackingUrl = event.trackingUrl || fulfillment.trackingUrl || shippingLabel.trackingUrl
  const shouldPromoteOpen = fulfillment.status === 'PENDING' && Boolean(resolvedTrackingNumber || resolvedTrackingUrl)

  const hasChanges =
    shouldMarkDelivered ||
    shouldPromoteOpen ||
    (!fulfillment.trackingNumber && Boolean(resolvedTrackingNumber)) ||
    (!fulfillment.trackingUrl && Boolean(resolvedTrackingUrl))

  if (!hasChanges) {
    return { handled: true }
  }

  await prisma.$transaction(async (tx) => {
    await tx.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: shouldMarkDelivered ? 'SUCCESS' : shouldPromoteOpen ? 'OPEN' : undefined,
        deliveredAt: shouldMarkDelivered ? deliveredAt : undefined,
        trackingNumber: resolvedTrackingNumber || undefined,
        trackingUrl: resolvedTrackingUrl || undefined,
      },
    })

    await tx.shippingLabel.update({
      where: { id: shippingLabel.id },
      data: {
        status: event.providerStatus || undefined,
        trackingNumber: resolvedTrackingNumber || undefined,
        trackingUrl: resolvedTrackingUrl || undefined,
      },
    })

    await tx.orderEvent.create({
      data: {
        orderId: shippingLabel.orderId,
        type: shouldMarkDelivered ? 'SHIPPING_DELIVERED' : 'SHIPPING_TRACKING_UPDATED',
        title: shouldMarkDelivered
          ? resolvedTrackingNumber
            ? `Shipment delivered: ${resolvedTrackingNumber}`
            : 'Shipment delivered'
          : resolvedTrackingNumber
            ? `Tracking updated: ${resolvedTrackingNumber}`
            : 'Shipping tracking updated',
        detail: `${event.provider} webhook reported ${event.providerStatus || event.lifecycleStatus}`,
        actorType: 'SYSTEM',
      },
    })
  })

  await queueShippingTrackingSyncJob({
    fulfillmentId: fulfillment.id,
    orderId: shippingLabel.orderId,
  })

  return { handled: true }
}
