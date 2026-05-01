import { describe, expect, it } from 'vitest'

import {
  buildDeliveryStats,
  filterDeliveriesBySearch,
  getDeliveryDisplayStatus,
  getModeStatusFilter,
} from './delivery-logs.helpers'

describe('delivery logs helpers', () => {
  it('maps global status filters to mode-specific API statuses', () => {
    expect(getModeStatusFilter('inbound', 'RETRYING')).toBe('RETRY_PENDING')
    expect(getModeStatusFilter('outbound', 'DELIVERED')).toBe('SUCCESS')
    expect(getModeStatusFilter('email', 'FAILED')).toBe('FAILED')
  })

  it('derives received/processed/retrying/failed stats from existing rows safely', () => {
    const inboundStats = buildDeliveryStats({
      mode: 'inbound',
      inboundRows: [
        { status: 'PROCESSED' },
        { status: 'RETRY_PENDING' },
        { status: 'FAILED' },
        { status: 'SIGNATURE_FAILED' },
      ],
      totals: { inbound: 9 },
    } as any)

    expect(inboundStats.received).toBe(9)
    expect(inboundStats.processed).toBe(1)
    expect(inboundStats.retrying).toBe(1)
    expect(inboundStats.failed).toBe(2)
  })

  it('keeps status chips honest for outbound and email rows', () => {
    expect(getDeliveryDisplayStatus('outbound', 'SUCCESS')).toEqual({ label: 'Delivered', tone: 'success' })
    expect(getDeliveryDisplayStatus('outbound', 'EXHAUSTED')).toEqual({ label: 'Failed', tone: 'danger' })
    expect(getDeliveryDisplayStatus('email', 'SENT')).toEqual({ label: 'Delivered', tone: 'success' })
    expect(getDeliveryDisplayStatus('email', 'BOUNCED')).toEqual({ label: 'Failed', tone: 'danger' })
  })

  it('filters outbound rows by id, integration, event, and error text', () => {
    const rows = [
      {
        id: 'out_1',
        event: 'order.paid',
        status: 'SUCCESS',
        statusCode: 200,
        lastError: null,
        integration: { name: 'Warehouse sync', webhookUrl: 'https://warehouse.example/webhooks' },
      },
      {
        id: 'out_2',
        event: 'refund.created',
        status: 'FAILED',
        statusCode: 500,
        lastError: 'HTTP Error 500',
        integration: { name: 'Slack alerts', webhookUrl: 'https://slack.example/hooks' },
      },
    ]

    expect(filterDeliveriesBySearch('outbound', rows, 'warehouse')).toHaveLength(1)
    expect(filterDeliveriesBySearch('outbound', rows, 'refund.created')).toHaveLength(1)
    expect(filterDeliveriesBySearch('outbound', rows, '500')).toHaveLength(1)
  })
})
