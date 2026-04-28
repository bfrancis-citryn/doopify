import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/server/utils/crypto'
import type { OutboundWebhookDelivery } from '@prisma/client'

const MAX_ATTEMPTS = 5;

function calculateNextRetry(attempt: number): Date {
  const baseDelayMs = 1000 * 60; // 1 minute
  const delay = baseDelayMs * Math.pow(3, attempt - 1); // 1m, 3m, 9m, 27m, 81m
  return new Date(Date.now() + delay);
}

function signPayload(payloadStr: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadStr).digest('base64');
}

export async function processOutboundWebhook(deliveryId: string) {
  const delivery = await prisma.outboundWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { integration: { include: { secrets: true } } }
  });

  if (!delivery || !delivery.integration || (delivery.status !== 'PENDING' && delivery.status !== 'RETRYING')) {
    return;
  }

  const integration = delivery.integration;
  if (!integration.webhookUrl) {
    await prisma.outboundWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', lastError: 'Missing webhook URL on integration' }
    });
    return;
  }

  const newAttempts = delivery.attempts + 1;
  let status = 'SUCCESS';
  let lastError = null;
  let statusCode = null;
  let responseBody = null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Doopify-Webhook-Dispatcher/1.0',
      'X-Doopify-Event': delivery.event,
    };

    if (integration.webhookSecret) {
      const decryptedSecret = decrypt(integration.webhookSecret);
      headers['X-Doopify-Signature'] = signPayload(delivery.payload, decryptedSecret);
    }

    const payloadObj = JSON.parse(delivery.payload);
    
    // Inject custom headers if provided as secrets
    const customHeaderPrefix = 'HEADER_';
    for (const secret of integration.secrets) {
      if (secret.key.startsWith(customHeaderPrefix)) {
        const headerName = secret.key.substring(customHeaderPrefix.length);
        headers[headerName] = decrypt(secret.value);
      }
    }

    const response = await fetch(integration.webhookUrl, {
      method: 'POST',
      headers,
      body: delivery.payload,
      // Setting an aggressive timeout can be configured here 
    });

    statusCode = response.status;
    const bodyText = await response.text();
    responseBody = bodyText.substring(0, 1000); // Truncate highly large responses

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

  } catch (error: any) {
    lastError = error.message;
    status = newAttempts >= MAX_ATTEMPTS ? 'EXHAUSTED' : 'RETRYING';
  }

  await prisma.outboundWebhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: status as any,
      attempts: newAttempts,
      statusCode,
      responseBody,
      lastError,
      lastRetriedAt: new Date(),
      processedAt: status === 'SUCCESS' || status === 'EXHAUSTED' ? new Date() : null,
      nextRetryAt: status === 'RETRYING' ? calculateNextRetry(newAttempts) : null,
    }
  });
}

export async function processDueOutboundDeliveries() {
  const dueDeliveries = await prisma.outboundWebhookDelivery.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'RETRYING', nextRetryAt: { lte: new Date() } }
      ]
    },
    take: 50,
    orderBy: { createdAt: 'asc' }
  });

  const results = await Promise.allSettled(
    dueDeliveries.map(delivery => processOutboundWebhook(delivery.id))
  );

  return {
    processed: results.length,
    success: results.filter(r => r.status === 'fulfilled').length,
    failures: results.filter(r => r.status === 'rejected').length,
  };
}
