import { env } from '@/lib/env'

export type SendEmailInput = {
  from: string
  to: string[]
  subject: string
  html: string
}

export type SendEmailResult = {
  provider: 'resend' | 'preview'
  providerMessageId?: string
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    console.info('[email.preview] Transactional email', {
      to: input.to,
      subject: input.subject,
    })
    return { provider: 'preview', providerMessageId: undefined }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Resend request failed: ${responseText}`)
  }

  let providerMessageId: string | undefined
  try {
    const payload = JSON.parse(responseText)
    providerMessageId = typeof payload?.id === 'string' ? payload.id : undefined
  } catch {
    providerMessageId = undefined
  }

  return { provider: 'resend', providerMessageId }
}
