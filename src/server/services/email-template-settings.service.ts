import { prisma } from '@/lib/prisma'

export type EmailTemplateKey = 'order_confirmation' | 'fulfillment_tracking'

export const EDITABLE_TEMPLATE_KEYS: readonly EmailTemplateKey[] = [
  'order_confirmation',
  'fulfillment_tracking',
] as const

export type EmailTemplateSettingFields = {
  enabled: boolean
  subject: string
  preheader: string
  headerTitle: string
  bodyText: string
  buttonLabel: string
  footerText: string
  replyToEmail: string | null
}

export type EmailTemplateSetting = EmailTemplateSettingFields & {
  id: string
  templateKey: string
  createdAt: Date
  updatedAt: Date
}

const TEMPLATE_DEFAULTS: Record<EmailTemplateKey, EmailTemplateSettingFields> = {
  order_confirmation: {
    enabled: true,
    subject: 'Your order {{orderNumber}} is confirmed',
    preheader: 'Thank you for your purchase.',
    headerTitle: 'Order confirmation',
    bodyText: 'Thanks for your order! We\'ll send you another email when your order ships.',
    buttonLabel: 'View order',
    footerText: 'Thank you for choosing us.',
    replyToEmail: null,
  },
  fulfillment_tracking: {
    enabled: true,
    subject: 'Your order {{orderNumber}} has shipped',
    preheader: 'Your order is on the way.',
    headerTitle: 'Your order is on the way',
    bodyText: 'Good news! Your order has shipped and is on its way to you.',
    buttonLabel: 'Track shipment',
    footerText: 'Thank you for choosing us.',
    replyToEmail: null,
  },
}

export function getTemplateDefaults(templateKey: EmailTemplateKey): EmailTemplateSettingFields {
  return { ...TEMPLATE_DEFAULTS[templateKey] }
}

export function isEditableTemplateKey(key: string): key is EmailTemplateKey {
  return EDITABLE_TEMPLATE_KEYS.includes(key as EmailTemplateKey)
}

// Safe variable substitution — only the declared safe set is interpolated.
const SAFE_VARIABLES = new Set([
  'orderNumber',
  'storeName',
  'customerName',
  'trackingNumber',
  'trackingUrl',
])

export function renderTemplateVariables(
  text: string,
  vars: Partial<Record<string, string>>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (SAFE_VARIABLES.has(key)) {
      return vars[key] ?? ''
    }
    return `{{${key}}}`
  })
}

function rowToFields(row: {
  enabled: boolean
  subject: string | null
  preheader: string | null
  headerTitle: string | null
  bodyText: string | null
  buttonLabel: string | null
  footerText: string | null
  replyToEmail: string | null
}, defaults: EmailTemplateSettingFields): EmailTemplateSettingFields {
  return {
    enabled: row.enabled,
    subject: row.subject ?? defaults.subject,
    preheader: row.preheader ?? defaults.preheader,
    headerTitle: row.headerTitle ?? defaults.headerTitle,
    bodyText: row.bodyText ?? defaults.bodyText,
    buttonLabel: row.buttonLabel ?? defaults.buttonLabel,
    footerText: row.footerText ?? defaults.footerText,
    replyToEmail: row.replyToEmail,
  }
}

export async function getEmailTemplateSetting(templateKey: EmailTemplateKey): Promise<{
  templateKey: EmailTemplateKey
  isCustomized: boolean
  fields: EmailTemplateSettingFields
}> {
  const row = await prisma.emailTemplateSetting.findUnique({
    where: { templateKey },
  })

  const defaults = getTemplateDefaults(templateKey)
  const fields = row ? rowToFields(row, defaults) : defaults

  return {
    templateKey,
    isCustomized: Boolean(row),
    fields,
  }
}

export async function upsertEmailTemplateSetting(
  templateKey: EmailTemplateKey,
  patch: Partial<EmailTemplateSettingFields>
) {
  const row = await prisma.emailTemplateSetting.upsert({
    where: { templateKey },
    create: {
      templateKey,
      enabled: patch.enabled ?? true,
      subject: patch.subject ?? null,
      preheader: patch.preheader ?? null,
      headerTitle: patch.headerTitle ?? null,
      bodyText: patch.bodyText ?? null,
      buttonLabel: patch.buttonLabel ?? null,
      footerText: patch.footerText ?? null,
      replyToEmail: patch.replyToEmail ?? null,
    },
    update: {
      ...('enabled' in patch && { enabled: patch.enabled }),
      ...('subject' in patch && { subject: patch.subject }),
      ...('preheader' in patch && { preheader: patch.preheader }),
      ...('headerTitle' in patch && { headerTitle: patch.headerTitle }),
      ...('bodyText' in patch && { bodyText: patch.bodyText }),
      ...('buttonLabel' in patch && { buttonLabel: patch.buttonLabel }),
      ...('footerText' in patch && { footerText: patch.footerText }),
      ...('replyToEmail' in patch && { replyToEmail: patch.replyToEmail }),
    },
  })

  const defaults = getTemplateDefaults(templateKey)
  return {
    templateKey,
    isCustomized: true,
    fields: rowToFields(row, defaults),
  }
}

export async function resetEmailTemplateSetting(templateKey: EmailTemplateKey) {
  await prisma.emailTemplateSetting.deleteMany({ where: { templateKey } })
  return {
    templateKey,
    isCustomized: false,
    fields: getTemplateDefaults(templateKey),
  }
}

export function isTemplateEnabled(fields: EmailTemplateSettingFields): boolean {
  return fields.enabled
}
