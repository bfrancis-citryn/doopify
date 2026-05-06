export type WizardStepStatus = 'ready' | 'needs_setup' | 'optional' | 'skipped'

export type WizardStep = {
  id: string
  step: number
  title: string
  status: WizardStepStatus
  reason: string
  ctaRoute?: string
  ctaLabel?: string
  docsLink: string
  isRequired: boolean
}

export type SetupWizardReport = {
  steps: WizardStep[]
  completedCount: number
  requiredCount: number
  wizardComplete: boolean
}

export type SetupWizardFacts = {
  ownerExists: boolean
  storeNameConfigured: boolean
  storeEmailConfigured: boolean
  storeUrlReady: boolean
  storeUrlIssue: 'missing' | 'invalid' | 'placeholder' | 'localhost_production' | null
  stripeSource: 'db' | 'env' | 'none'
  stripeVerified: boolean
  stripeHasSecretKey: boolean
  stripeHasPublishableKey: boolean
  stripeHasWebhookSecret: boolean
  stripeWebhookDeliveryReceived: boolean
  shippingCanUseManualRates: boolean
  shippingCanUseLiveRates: boolean
  emailProviderSource: 'db' | 'env' | 'none'
  activeProductCount: number
  activeProductsWithValidPrice: number
  activeProductsWithInventory: number
  recentPaidOrderExists: boolean
}

export function buildSetupWizardSteps(facts: SetupWizardFacts): SetupWizardReport {
  const steps: WizardStep[] = []

  // Step 1 - Owner account
  steps.push({
    id: 'owner-account',
    step: 1,
    title: 'Owner account',
    isRequired: true,
    status: facts.ownerExists ? 'ready' : 'needs_setup',
    reason: facts.ownerExists
      ? 'Owner account exists and is active.'
      : 'No owner account found. Create the first owner to access the admin.',
    ctaRoute: facts.ownerExists ? undefined : '/create-owner',
    ctaLabel: facts.ownerExists ? undefined : 'Create owner',
    docsLink: '/docs/setup/first-owner',
  })

  // Step 2 - Store profile
  const storeProfileReady = facts.storeNameConfigured && facts.storeEmailConfigured
  steps.push({
    id: 'store-profile',
    step: 2,
    title: 'Store profile',
    isRequired: true,
    status: storeProfileReady ? 'ready' : 'needs_setup',
    reason: storeProfileReady
      ? 'Store name and contact email are configured.'
      : 'Store name or contact email is missing.',
    ctaRoute: storeProfileReady ? undefined : '/settings?section=general',
    ctaLabel: storeProfileReady ? undefined : 'Edit store profile',
    docsLink: '/docs/quickstart',
  })

  // Step 3 - Stripe connection
  const stripeHasKeys = facts.stripeHasSecretKey && facts.stripeHasPublishableKey
  const stripeUsable = facts.stripeSource !== 'none' && stripeHasKeys
  let stripeStatus: WizardStepStatus
  let stripeReason: string

  if (!stripeUsable) {
    stripeStatus = 'needs_setup'
    stripeReason = 'Stripe API keys are not configured. Checkout cannot process payments.'
  } else if (facts.stripeSource === 'env') {
    stripeStatus = 'needs_setup'
    stripeReason =
      'Stripe is using environment fallback credentials. Save and verify Stripe in Settings -> Payments for private beta readiness.'
  } else if (!facts.stripeVerified) {
    stripeStatus = 'needs_setup'
    stripeReason = 'Stripe credentials are saved but have not been verified. Run verification in Settings -> Payments.'
  } else {
    stripeStatus = 'ready'
    stripeReason = 'Stripe credentials are saved and verified.'
  }

  steps.push({
    id: 'stripe-connection',
    step: 3,
    title: 'Stripe connection',
    isRequired: true,
    status: stripeStatus,
    reason: stripeReason,
    ctaRoute: stripeStatus !== 'ready' ? '/settings?section=payments' : undefined,
    ctaLabel: stripeStatus !== 'ready' ? 'Configure Stripe' : undefined,
    docsLink: '/docs/setup/stripe',
  })

  // Step 4 - Stripe webhook
  let webhookStatus: WizardStepStatus
  let webhookReason: string

  if (!facts.storeUrlReady) {
    webhookStatus = 'needs_setup'
    webhookReason =
      facts.storeUrlIssue === 'placeholder'
        ? 'Store URL needs setup. NEXT_PUBLIC_STORE_URL is still using a placeholder domain; set it to the deployed storefront URL before configuring Stripe webhooks.'
        : facts.storeUrlIssue === 'localhost_production'
          ? 'Store URL needs setup. NEXT_PUBLIC_STORE_URL cannot use localhost in production.'
          : 'Store URL needs setup. Configure NEXT_PUBLIC_STORE_URL with the deployed storefront domain before configuring Stripe webhooks.'
  } else if (!facts.stripeHasWebhookSecret) {
    webhookStatus = 'needs_setup'
    webhookReason =
      'STRIPE_WEBHOOK_SECRET is not set. Orders are created by verified webhook, not browser redirect. Set the secret and register the endpoint.'
  } else if (!facts.stripeWebhookDeliveryReceived) {
    webhookStatus = 'needs_setup'
    webhookReason =
      'Webhook secret is configured but no processed Stripe delivery has been received. Register the webhook endpoint and run a test checkout.'
  } else {
    webhookStatus = 'ready'
    webhookReason = 'Stripe webhook secret is set and at least one delivery has been processed.'
  }

  steps.push({
    id: 'stripe-webhook',
    step: 4,
    title: 'Stripe webhook',
    isRequired: true,
    status: webhookStatus,
    reason: webhookReason,
    ctaRoute:
      webhookStatus !== 'ready'
        ? !facts.storeUrlReady
          ? '/settings?section=setup'
          : '/admin/webhooks'
        : undefined,
    ctaLabel:
      webhookStatus !== 'ready'
        ? !facts.storeUrlReady
          ? 'Fix store URL'
          : 'View delivery logs'
        : undefined,
    docsLink: '/docs/setup/stripe',
  })

  // Step 5 - Shipping rate
  const shippingReady = facts.shippingCanUseManualRates || facts.shippingCanUseLiveRates
  steps.push({
    id: 'shipping',
    step: 5,
    title: 'Shipping rate',
    isRequired: true,
    status: shippingReady ? 'ready' : 'needs_setup',
    reason: shippingReady
      ? facts.shippingCanUseLiveRates
        ? 'Live carrier rates are configured and the provider is connected.'
        : 'Manual shipping rates are configured.'
      : 'No active shipping method. Add at least one flat rate before customers can check out.',
    ctaRoute: shippingReady ? undefined : '/settings?section=shipping',
    ctaLabel: shippingReady ? undefined : 'Configure shipping',
    docsLink: '/docs/setup/shipping',
  })

  // Step 6 - Email provider (optional)
  const emailReady = facts.emailProviderSource === 'db'
  steps.push({
    id: 'email-provider',
    step: 6,
    title: 'Email provider',
    isRequired: false,
    status: emailReady ? 'ready' : 'optional',
    reason: emailReady
      ? 'Email provider is configured and verified in Settings -> Email.'
      : facts.emailProviderSource === 'env'
        ? 'Email is using environment fallback credentials. Configure and verify a provider in Settings -> Email.'
        : 'No email provider configured. Order confirmation emails are optional for private beta.',
    ctaRoute: emailReady ? undefined : '/settings?section=email',
    ctaLabel: emailReady ? undefined : 'Configure email',
    docsLink: '/docs/setup/email',
  })

  // Step 7 - Product
  const hasActiveProduct = facts.activeProductCount > 0
  const hasValidPrice = facts.activeProductsWithValidPrice > 0
  const hasInventory = facts.activeProductsWithInventory > 0
  let productStatus: WizardStepStatus
  let productReason: string

  if (!hasActiveProduct) {
    productStatus = 'needs_setup'
    productReason = 'No active products found. Create and publish at least one product.'
  } else if (!hasValidPrice) {
    productStatus = 'needs_setup'
    productReason = 'Active products exist but none have a non-zero price set.'
  } else if (!hasInventory) {
    productStatus = 'needs_setup'
    productReason = 'Active products exist but all variants have zero inventory.'
  } else {
    productStatus = 'ready'
    productReason = `${facts.activeProductCount} active product(s) with valid price and inventory.`
  }

  steps.push({
    id: 'product',
    step: 7,
    title: 'Product',
    isRequired: true,
    status: productStatus,
    reason: productReason,
    ctaRoute: productStatus !== 'ready' ? '/products' : undefined,
    ctaLabel: productStatus !== 'ready' ? 'Go to products' : undefined,
    docsLink: '/docs/quickstart',
  })

  // Step 8 - Test checkout
  steps.push({
    id: 'test-checkout',
    step: 8,
    title: 'Test checkout',
    isRequired: true,
    status: facts.recentPaidOrderExists ? 'ready' : 'needs_setup',
    reason: facts.recentPaidOrderExists
      ? 'A recent paid order exists. The checkout and webhook flow is working.'
      : 'No recent paid order found. Run a test checkout using Stripe card 4242 4242 4242 4242.',
    ctaRoute: facts.recentPaidOrderExists ? '/orders' : undefined,
    ctaLabel: facts.recentPaidOrderExists ? 'View orders' : undefined,
    docsLink: '/docs/operations/pilot-smoke-checklist',
  })

  // Step 9 - Pilot readiness (aggregate)
  const requiredSteps = steps.filter((s) => s.isRequired)
  const failingRequired = requiredSteps.filter((s) => s.status === 'needs_setup')
  const pilotReady = failingRequired.length === 0

  steps.push({
    id: 'pilot-readiness',
    step: 9,
    title: 'Pilot readiness',
    isRequired: false,
    status: pilotReady ? 'ready' : 'needs_setup',
    reason: pilotReady
      ? 'All required setup steps are complete. The store is ready for a private beta pilot.'
      : `${failingRequired.length} required step(s) still need setup before the store is ready.`,
    docsLink: '/docs/operations/pilot-smoke-checklist',
  })

  const completedCount = steps.filter((s) => s.status === 'ready').length
  const requiredCount = steps.filter((s) => s.isRequired).length

  return {
    steps,
    completedCount,
    requiredCount,
    wizardComplete: pilotReady,
  }
}
