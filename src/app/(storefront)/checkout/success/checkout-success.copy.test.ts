import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const PAGE = 'src/app/(storefront)/checkout/success/CheckoutSuccessClientPage.tsx'

describe('checkout success waiting-state copy', () => {
  it('times out polling and explains webhook-delay confirmation state', () => {
    const source = read(PAGE)
    expect(source).toContain('WEBHOOK_WAIT_TIMEOUT_MS')
    expect(source).toContain('Payment succeeded, but order confirmation is waiting on Stripe webhook delivery.')
  })

  it('includes owner/development debugging hint and retry action', () => {
    const source = read(PAGE)
    expect(source).toContain('If you manage this store, check Stripe webhook endpoint URL and delivery logs.')
    expect(source).toContain('Retry status check')
    expect(source).toContain('handleRetryStatusCheck')
  })
})
