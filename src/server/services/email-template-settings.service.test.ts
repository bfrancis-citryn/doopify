import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    emailTemplateSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))

import {
  getEmailTemplateSetting,
  getTemplateDefaults,
  isEditableTemplateKey,
  isTemplateEnabled,
  renderTemplateVariables,
  resetEmailTemplateSetting,
  upsertEmailTemplateSetting,
} from './email-template-settings.service'

describe('getTemplateDefaults', () => {
  it('returns defaults for order_confirmation', () => {
    const defaults = getTemplateDefaults('order_confirmation')
    expect(defaults.enabled).toBe(true)
    expect(defaults.subject).toContain('{{orderNumber}}')
    expect(defaults.headerTitle).toBeTruthy()
    expect(defaults.bodyText).toBeTruthy()
    expect(defaults.buttonLabel).toBeTruthy()
  })

  it('returns defaults for fulfillment_tracking', () => {
    const defaults = getTemplateDefaults('fulfillment_tracking')
    expect(defaults.enabled).toBe(true)
    expect(defaults.subject).toContain('{{orderNumber}}')
  })
})

describe('isEditableTemplateKey', () => {
  it('returns true for editable templates', () => {
    expect(isEditableTemplateKey('order_confirmation')).toBe(true)
    expect(isEditableTemplateKey('fulfillment_tracking')).toBe(true)
  })

  it('returns false for non-editable templates', () => {
    expect(isEditableTemplateKey('refund_confirmation')).toBe(false)
    expect(isEditableTemplateKey('draft_invoice')).toBe(false)
    expect(isEditableTemplateKey('customer_note')).toBe(false)
    expect(isEditableTemplateKey('unknown_template')).toBe(false)
  })
})

describe('renderTemplateVariables', () => {
  it('replaces allowed variables', () => {
    const result = renderTemplateVariables(
      'Your order {{orderNumber}} from {{storeName}}',
      { orderNumber: '#1001', storeName: 'Test Shop' }
    )
    expect(result).toBe('Your order #1001 from Test Shop')
  })

  it('leaves unknown variables unchanged (safe passthrough)', () => {
    const result = renderTemplateVariables(
      'Hello {{unknown}} world',
      {}
    )
    expect(result).toBe('Hello {{unknown}} world')
  })

  it('replaces missing safe variables with empty string', () => {
    const result = renderTemplateVariables(
      'Order {{orderNumber}}',
      {}
    )
    expect(result).toBe('Order ')
  })

  it('does not execute code or replace unsafe patterns', () => {
    const result = renderTemplateVariables(
      '{{__proto__}} or {{constructor}} or <script>',
      {}
    )
    expect(result).not.toContain('undefined')
    expect(result).toContain('{{__proto__}}')
    expect(result).toContain('<script>')
  })
})

describe('getEmailTemplateSetting', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns defaults when no DB row exists', async () => {
    mocks.prisma.emailTemplateSetting.findUnique.mockResolvedValue(null)

    const result = await getEmailTemplateSetting('order_confirmation')

    expect(result.isCustomized).toBe(false)
    expect(result.fields.enabled).toBe(true)
    expect(result.fields.subject).toContain('{{orderNumber}}')
  })

  it('returns saved settings merged with defaults when DB row exists', async () => {
    mocks.prisma.emailTemplateSetting.findUnique.mockResolvedValue({
      id: 'tpl_1',
      templateKey: 'order_confirmation',
      enabled: false,
      subject: 'Custom subject {{orderNumber}}',
      preheader: null,
      headerTitle: null,
      bodyText: null,
      buttonLabel: null,
      footerText: 'Custom footer',
      replyToEmail: 'support@example.com',
    })

    const result = await getEmailTemplateSetting('order_confirmation')

    expect(result.isCustomized).toBe(true)
    expect(result.fields.enabled).toBe(false)
    expect(result.fields.subject).toBe('Custom subject {{orderNumber}}')
    expect(result.fields.footerText).toBe('Custom footer')
    expect(result.fields.replyToEmail).toBe('support@example.com')
    // Falls back to default for null fields
    const defaults = getTemplateDefaults('order_confirmation')
    expect(result.fields.headerTitle).toBe(defaults.headerTitle)
  })
})

describe('upsertEmailTemplateSetting', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves editable fields and returns updated settings', async () => {
    const savedRow = {
      id: 'tpl_1',
      templateKey: 'order_confirmation',
      enabled: true,
      subject: 'Updated subject',
      preheader: null,
      headerTitle: null,
      bodyText: null,
      buttonLabel: null,
      footerText: null,
      replyToEmail: null,
    }
    mocks.prisma.emailTemplateSetting.upsert.mockResolvedValue(savedRow)

    const result = await upsertEmailTemplateSetting('order_confirmation', {
      subject: 'Updated subject',
    })

    expect(result.isCustomized).toBe(true)
    expect(result.fields.subject).toBe('Updated subject')
    expect(mocks.prisma.emailTemplateSetting.upsert).toHaveBeenCalledOnce()
  })
})

describe('resetEmailTemplateSetting', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the DB row and returns defaults', async () => {
    mocks.prisma.emailTemplateSetting.deleteMany.mockResolvedValue({ count: 1 })

    const result = await resetEmailTemplateSetting('order_confirmation')

    expect(result.isCustomized).toBe(false)
    expect(mocks.prisma.emailTemplateSetting.deleteMany).toHaveBeenCalledWith({
      where: { templateKey: 'order_confirmation' },
    })
    const defaults = getTemplateDefaults('order_confirmation')
    expect(result.fields.subject).toBe(defaults.subject)
  })
})

describe('isTemplateEnabled', () => {
  it('returns true when enabled', () => {
    expect(isTemplateEnabled({ enabled: true } as any)).toBe(true)
  })

  it('returns false when disabled — does not throw or affect other paths', () => {
    expect(isTemplateEnabled({ enabled: false } as any)).toBe(false)
  })
})
