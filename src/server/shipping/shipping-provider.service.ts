import type { IntegrationStatus, ShippingLiveProvider } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/server/utils/crypto'
import type { ShippingRateQuote, ShippingRateRequest } from '@/server/shipping/shipping-rate.types'

import { easypostProviderAdapter } from './providers/easypost'
import { shippoProviderAdapter } from './providers/shippo'
import type {
  ShippingProviderConnectionResult,
  ShippingProviderPurchaseLabelRequest,
} from './providers/types'

const PROVIDER_INTEGRATION_TYPE: Record<ShippingLiveProvider, string> = {
  EASYPOST: 'SHIPPING_EASYPOST',
  SHIPPO: 'SHIPPING_SHIPPO',
}

const PROVIDER_SECRET_KEY: Record<ShippingLiveProvider, string> = {
  EASYPOST: 'API_KEY',
  SHIPPO: 'API_KEY',
}

const PROVIDER_NAME: Record<ShippingLiveProvider, string> = {
  EASYPOST: 'EasyPost Shipping',
  SHIPPO: 'Shippo Shipping',
}

function normalizeApiKey(value: string) {
  return value.trim()
}

function resolveProviderAdapter(provider: ShippingLiveProvider) {
  if (provider === 'EASYPOST') return easypostProviderAdapter
  return shippoProviderAdapter
}

export function providerToIntegrationType(provider: ShippingLiveProvider) {
  return PROVIDER_INTEGRATION_TYPE[provider]
}

export type ShippingProviderConnectionStatus = {
  provider: ShippingLiveProvider
  integrationType: string
  integrationId: string | null
  integrationStatus: IntegrationStatus | null
  hasCredentials: boolean
  connected: boolean
  updatedAt: string | null
}

export type ConnectShippingProviderInput = {
  provider: ShippingLiveProvider
  apiKey: string
}

export type DisconnectShippingProviderInput = {
  provider: ShippingLiveProvider
  clearCredentials?: boolean
}

async function findLatestProviderIntegration(provider: ShippingLiveProvider) {
  return prisma.integration.findFirst({
    where: { type: providerToIntegrationType(provider) },
    include: {
      secrets: {
        select: { key: true, value: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

function toConnectionStatus(
  provider: ShippingLiveProvider,
  integration: Awaited<ReturnType<typeof findLatestProviderIntegration>>
): ShippingProviderConnectionStatus {
  const secretKey = PROVIDER_SECRET_KEY[provider]
  const hasCredentials = Boolean(integration?.secrets.some((secret) => secret.key === secretKey && secret.value))
  const integrationStatus = integration?.status ?? null
  const connected = Boolean(integrationStatus === 'ACTIVE' && hasCredentials)

  return {
    provider,
    integrationType: providerToIntegrationType(provider),
    integrationId: integration?.id ?? null,
    integrationStatus,
    hasCredentials,
    connected,
    updatedAt: integration?.updatedAt?.toISOString() ?? null,
  }
}

async function getProviderApiKey(provider: ShippingLiveProvider) {
  const integration = await findLatestProviderIntegration(provider)
  if (!integration || integration.status !== 'ACTIVE') {
    return null
  }

  const secret = integration.secrets.find((entry) => entry.key === PROVIDER_SECRET_KEY[provider])
  if (!secret?.value) return null

  return {
    integrationId: integration.id,
    apiKey: decrypt(secret.value),
  }
}

export async function getShippingProviderApiKey(provider: ShippingLiveProvider) {
  const credentials = await getProviderApiKey(provider)
  return credentials?.apiKey ?? null
}

export async function getShippingProviderConnectionStatus(provider: ShippingLiveProvider) {
  const integration = await findLatestProviderIntegration(provider)
  return toConnectionStatus(provider, integration)
}

export async function connectShippingProvider(input: ConnectShippingProviderInput) {
  const apiKey = normalizeApiKey(input.apiKey)
  if (!apiKey) {
    throw new Error('Provider API key is required')
  }

  const provider = input.provider
  const integrationType = providerToIntegrationType(provider)
  const providerSecretKey = PROVIDER_SECRET_KEY[provider]

  await prisma.$transaction(async (tx) => {
    const existing = await tx.integration.findFirst({
      where: { type: integrationType },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    const integration =
      existing != null
        ? await tx.integration.update({
            where: { id: existing.id },
            data: {
              name: PROVIDER_NAME[provider],
              status: 'ACTIVE',
              type: integrationType,
            },
            select: { id: true },
          })
        : await tx.integration.create({
            data: {
              name: PROVIDER_NAME[provider],
              type: integrationType,
              status: 'ACTIVE',
            },
            select: { id: true },
          })

    await tx.integrationSecret.upsert({
      where: {
        integrationId_key: {
          integrationId: integration.id,
          key: providerSecretKey,
        },
      },
      create: {
        integrationId: integration.id,
        key: providerSecretKey,
        value: encrypt(apiKey),
      },
      update: {
        value: encrypt(apiKey),
      },
    })
  })

  return getShippingProviderConnectionStatus(provider)
}

export async function disconnectShippingProvider(input: DisconnectShippingProviderInput) {
  const { provider, clearCredentials = false } = input
  const integrationType = providerToIntegrationType(provider)
  const integration = await findLatestProviderIntegration(provider)

  if (!integration) {
    return getShippingProviderConnectionStatus(provider)
  }

  await prisma.$transaction(async (tx) => {
    await tx.integration.update({
      where: { id: integration.id },
      data: { status: 'INACTIVE' },
    })

    if (clearCredentials) {
      await tx.integrationSecret.deleteMany({
        where: {
          integrationId: integration.id,
          key: PROVIDER_SECRET_KEY[provider],
        },
      })
    }

    // Keep only provider-typed integration rows affected by this action.
    await tx.integration.updateMany({
      where: {
        type: integrationType,
        id: { not: integration.id },
      },
      data: { status: 'INACTIVE' },
    })
  })

  return getShippingProviderConnectionStatus(provider)
}

export async function testShippingProviderConnection(provider: ShippingLiveProvider): Promise<{
  provider: ShippingLiveProvider
  status: ShippingProviderConnectionStatus
  result: ShippingProviderConnectionResult
}> {
  const credentials = await getProviderApiKey(provider)
  const status = await getShippingProviderConnectionStatus(provider)

  if (!credentials?.apiKey) {
    return {
      provider,
      status,
      result: {
        ok: false,
        message: 'Provider is not connected. Save credentials first.',
      },
    }
  }

  const adapter = resolveProviderAdapter(provider)
  const result = await adapter.testConnection({ apiKey: credentials.apiKey })
  return {
    provider,
    status,
    result,
  }
}

export async function getShippingProviderLiveRates(input: {
  provider: ShippingLiveProvider
  request: ShippingRateRequest
}): Promise<ShippingRateQuote[]> {
  const adapter = resolveProviderAdapter(input.provider)
  return adapter.getRates({
    ...input.request,
  })
}

export async function purchaseShippingProviderLabel(input: {
  provider: ShippingLiveProvider
  request: ShippingProviderPurchaseLabelRequest
}) {
  const adapter = resolveProviderAdapter(input.provider)
  return adapter.purchaseLabel(input.request)
}
