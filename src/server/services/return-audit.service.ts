import type { AuditActor } from '@/server/services/audit-log.service'
import { recordAuditLogBestEffort } from '@/server/services/audit-log.service'

const RETURN_AUDIT_TEXT_MAX_LENGTH = 240

export type ReturnAuditAction =
  | 'return.created'
  | 'return.approved'
  | 'return.declined'
  | 'return.marked_in_transit'
  | 'return.marked_received'
  | 'return.closed'
  | 'return.closed_with_refund'

const RETURN_AUDIT_REDACTIONS = ['private provider payloads', 'provider secrets'] as const

function summarizeText(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > RETURN_AUDIT_TEXT_MAX_LENGTH
    ? `${trimmed.slice(0, RETURN_AUDIT_TEXT_MAX_LENGTH)}...`
    : trimmed
}

function auditSummary(action: ReturnAuditAction, orderNumber: number | null | undefined) {
  const orderLabel = orderNumber ? `order ${orderNumber}` : 'order'
  switch (action) {
    case 'return.created':
      return `Return created for ${orderLabel}`
    case 'return.approved':
      return `Return approved for ${orderLabel}`
    case 'return.declined':
      return `Return declined for ${orderLabel}`
    case 'return.marked_in_transit':
      return `Return marked in transit for ${orderLabel}`
    case 'return.marked_received':
      return `Return marked received for ${orderLabel}`
    case 'return.closed':
      return `Return closed for ${orderLabel}`
    case 'return.closed_with_refund':
      return `Return closed with refund for ${orderLabel}`
  }
}

export async function safeAuditReturnEvent(input: {
  action: ReturnAuditAction
  actor?: AuditActor | null
  returnId: string
  orderId: string
  orderNumber?: number | null
  previousStatus?: string | null
  newStatus?: string | null
  reason?: string | null
  note?: string | null
  itemCount?: number | null
  refundId?: string | null
}) {
  const snapshot = {
    returnId: input.returnId,
    orderId: input.orderId,
    orderNumber: input.orderNumber ?? null,
    previousStatus: input.previousStatus ?? null,
    newStatus: input.newStatus ?? null,
    reasonSummary: summarizeText(input.reason),
    noteSummary: summarizeText(input.note),
    itemCount: input.itemCount ?? 0,
    refundId: input.refundId ?? null,
  }

  try {
    await recordAuditLogBestEffort({
      action: input.action,
      actor: input.actor ?? null,
      resource: { type: 'Return', id: input.returnId },
      summary: auditSummary(input.action, input.orderNumber),
      snapshot,
      redactions: [...RETURN_AUDIT_REDACTIONS],
    })
  } catch (error) {
    console.error('[return-audit] Audit emission failed', {
      action: input.action,
      returnId: input.returnId,
      error,
    })
  }
}
