type WizardStepStatus = 'ready' | 'needs_setup' | 'optional' | 'skipped'

type WizardStep = {
  id: string
  status: WizardStepStatus
  ctaRoute?: string
}

type SetupWizardReport = {
  wizardComplete?: boolean
  steps?: WizardStep[]
}

export type DashboardGuideStep = {
  id: string
  title: string
  description: string
  route: string
  ctaLabel: string
  statusLabel: string
}

export type DashboardFirstRunGuide = {
  requiredSteps: DashboardGuideStep[]
  optionalSteps: DashboardGuideStep[]
}

const REQUIRED_STEP_DEFS = [
  {
    id: 'store-profile',
    title: 'Store profile',
    description: 'Add your store name and contact email.',
    route: '/settings?section=general',
    ctaLabel: 'Open General',
  },
  {
    id: 'stripe-connection',
    title: 'Stripe',
    description: 'Save and verify Stripe credentials.',
    route: '/settings?section=payments',
    ctaLabel: 'Open Payments',
  },
  {
    id: 'shipping',
    title: 'Shipping',
    description: 'Set at least one active shipping rate.',
    route: '/settings?section=shipping',
    ctaLabel: 'Open Shipping',
  },
  {
    id: 'product',
    title: 'Product',
    description: 'Create an active product with price and inventory.',
    route: '/products',
    ctaLabel: 'Open Products',
  },
  {
    id: 'test-checkout',
    title: 'Test checkout',
    description: 'Run a paid test order and confirm it appears in Orders.',
    route: '/shop',
    ctaLabel: 'Open Storefront',
  },
] as const

const OPTIONAL_STEP_DEFS = [
  {
    id: 'email-provider',
    title: 'Email',
    description: 'Enable order confirmations and delivery updates.',
    route: '/settings?section=email',
    ctaLabel: 'Open Email',
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Invite staff and assign roles.',
    route: '/settings?section=team',
    ctaLabel: 'Open Team',
  },
  {
    id: 'mfa',
    title: 'MFA',
    description: 'Protect the owner account with authenticator MFA.',
    route: '/settings?section=account',
    ctaLabel: 'Open My account',
  },
] as const

export function buildDashboardFirstRunGuide(
  report: SetupWizardReport | null | undefined
): DashboardFirstRunGuide | null {
  if (!report || report.wizardComplete) return null

  const stepMap = new Map<string, WizardStep>(
    (report.steps || []).map((step) => [step.id, step])
  )

  const requiredSteps: DashboardGuideStep[] = REQUIRED_STEP_DEFS.map((stepDef) => {
    const matched = stepMap.get(stepDef.id)
    const isReady = matched?.status === 'ready'

    return {
      ...stepDef,
      route: isReady ? stepDef.route : matched?.ctaRoute || stepDef.route,
      statusLabel: isReady ? 'Ready' : 'Needs setup',
      ctaLabel: isReady ? 'Review' : stepDef.ctaLabel,
    }
  })

  const optionalSteps: DashboardGuideStep[] = OPTIONAL_STEP_DEFS.map((stepDef) => {
    const matched = stepMap.get(stepDef.id)
    const isReady = matched?.status === 'ready'

    return {
      ...stepDef,
      route: matched?.ctaRoute || stepDef.route,
      statusLabel: isReady ? 'Configured' : 'Optional',
      ctaLabel: isReady ? 'Review' : stepDef.ctaLabel,
    }
  })

  return {
    requiredSteps,
    optionalSteps,
  }
}
