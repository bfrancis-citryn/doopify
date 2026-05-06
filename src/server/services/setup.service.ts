import { evaluatePublicStoreUrl } from '@/lib/public-store-url'

export type SetupCheckStatus = 'PASS' | 'WARN' | 'FAIL'
export type SetupProfile = 'cli' | 'app'

export type SetupCheckCategory =
  | 'runtime'
  | 'database'
  | 'admin_owner'
  | 'store_settings'
  | 'stripe'
  | 'resend_email'
  | 'webhook_retry'
  | 'public_url'
  | 'deployment'

export type SetupCheck = {
  id: string
  title: string
  category: SetupCheckCategory
  status: SetupCheckStatus
  required: boolean
  summary: string
  fix?: string
}

export type SetupDoctorFacts = {
  nodeVersion: string
  nodeMajorVersion: number | null
  minimumNodeMajor: number
  npmAvailable: boolean
  npmVersion?: string
  dependenciesInstalled: boolean
  missingDependencies: string[]
  hasEnvFile: boolean
  hasEnvLocalFile: boolean
  databaseUrlPresent: boolean
  databaseReachable: boolean
  databaseError?: string
  prismaClientGenerated: boolean
  storeCount: number | null
  ownerCount: number | null
  storeConfigured: boolean | null
  storeContactConfigured: boolean | null
  jwtSecret?: string
  stripeSecretKeyPresent: boolean
  stripePublishableKeyPresent: boolean
  stripeWebhookSecretPresent: boolean
  webhookRetrySecret?: string
  resendApiKeyPresent: boolean
  resendWebhookSecretPresent: boolean
  emailProviderWebhooksEnabled: boolean
  nextPublicStoreUrl?: string
  vercelEnvironmentDetected: boolean
  vercelUrlPresent: boolean
}

export type SetupDoctorReport = {
  checks: SetupCheck[]
  passCount: number
  warnCount: number
  failCount: number
  requiredFailCount: number
  ok: boolean
}

export type BuildSetupDoctorReportOptions = {
  profile?: SetupProfile
}

const WEAK_SECRET_PATTERN = /(change[-_]?me|example|default|test|password|secret|doopify)/i

function isWeakSecret(value: string) {
  return WEAK_SECRET_PATTERN.test(value)
}

function evaluateJwtSecret(secret: string | undefined) {
  if (!secret) {
    return {
      status: 'FAIL' as const,
      summary: 'JWT_SECRET is missing.',
      fix: 'Set JWT_SECRET in .env.local to a random secret with at least 32 characters.',
    }
  }

  if (secret.length < 32) {
    return {
      status: 'FAIL' as const,
      summary: `JWT_SECRET is too short (${secret.length} characters).`,
      fix: 'Use a JWT_SECRET with at least 32 characters.',
    }
  }

  if (isWeakSecret(secret)) {
    return {
      status: 'WARN' as const,
      summary: 'JWT_SECRET appears to use a weak or placeholder pattern.',
      fix: 'Rotate JWT_SECRET to a high-entropy random value.',
    }
  }

  return {
    status: 'PASS' as const,
    summary: 'JWT_SECRET is present and strong enough.',
  }
}

function evaluateWebhookRetrySecret(secret: string | undefined) {
  if (!secret) {
    return {
      status: 'FAIL' as const,
      summary: 'WEBHOOK_RETRY_SECRET is missing.',
      fix: 'Set WEBHOOK_RETRY_SECRET in .env.local to a random secret with at least 16 characters.',
    }
  }

  if (secret.length < 16) {
    return {
      status: 'FAIL' as const,
      summary: `WEBHOOK_RETRY_SECRET is too short (${secret.length} characters).`,
      fix: 'Use a WEBHOOK_RETRY_SECRET with at least 16 characters.',
    }
  }

  if (isWeakSecret(secret)) {
    return {
      status: 'WARN' as const,
      summary: 'WEBHOOK_RETRY_SECRET appears to use a weak or placeholder pattern.',
      fix: 'Rotate WEBHOOK_RETRY_SECRET to a high-entropy random value.',
    }
  }

  return {
    status: 'PASS' as const,
    summary: 'WEBHOOK_RETRY_SECRET is present.',
  }
}

function evaluateStoreUrl(urlValue: string | undefined) {
  const evaluation = evaluatePublicStoreUrl({
    value: urlValue,
    nodeEnv: process.env.NODE_ENV,
  })

  if (evaluation.ready) {
    return {
      status: 'PASS' as const,
      summary: 'NEXT_PUBLIC_STORE_URL is present and valid.',
    }
  }

  return {
    status: 'FAIL' as const,
    summary: evaluation.message,
    fix: 'Set NEXT_PUBLIC_STORE_URL to your deployed storefront base URL (for example https://store.example.com).',
  }
}

export function buildSetupDoctorReport(
  facts: SetupDoctorFacts,
  options: BuildSetupDoctorReportOptions = {}
): SetupDoctorReport {
  const profile = options.profile ?? 'cli'
  const checks: SetupCheck[] = []

  if (profile === 'cli') {
    checks.push({
      id: 'node-version',
      title: 'Node version',
      category: 'runtime',
      required: true,
      status:
        facts.nodeMajorVersion !== null && facts.nodeMajorVersion >= facts.minimumNodeMajor
          ? 'PASS'
          : 'FAIL',
      summary:
        facts.nodeMajorVersion !== null && facts.nodeMajorVersion >= facts.minimumNodeMajor
          ? `Node ${facts.nodeVersion} satisfies minimum v${facts.minimumNodeMajor}.`
          : `Node ${facts.nodeVersion} is below minimum v${facts.minimumNodeMajor}.`,
      fix:
        facts.nodeMajorVersion !== null && facts.nodeMajorVersion >= facts.minimumNodeMajor
          ? undefined
          : `Upgrade Node.js to v${facts.minimumNodeMajor} or newer.`,
    })

    checks.push({
      id: 'npm-available',
      title: 'npm available',
      category: 'runtime',
      required: true,
      status: facts.npmAvailable ? 'PASS' : 'FAIL',
      summary: facts.npmAvailable
        ? `npm is available${facts.npmVersion ? ` (${facts.npmVersion})` : ''}.`
        : 'npm command is not available.',
      fix: facts.npmAvailable
        ? undefined
        : 'Install npm and ensure it is available on PATH.',
    })

    checks.push({
      id: 'package-install-state',
      title: 'Package install state',
      category: 'runtime',
      required: true,
      status: facts.dependenciesInstalled ? 'PASS' : 'FAIL',
      summary: facts.dependenciesInstalled
        ? 'Dependencies appear installed.'
        : `Missing dependencies: ${facts.missingDependencies.join(', ')}`,
      fix: facts.dependenciesInstalled
        ? undefined
        : 'Run npm install, then re-run npm run doopify:doctor.',
    })

    checks.push({
      id: 'env-files',
      title: '.env / .env.local presence',
      category: 'runtime',
      required: false,
      status: facts.hasEnvFile || facts.hasEnvLocalFile ? 'PASS' : 'WARN',
      summary: facts.hasEnvFile || facts.hasEnvLocalFile
        ? `Env files detected${facts.hasEnvFile && facts.hasEnvLocalFile ? ' (.env and .env.local)' : facts.hasEnvLocalFile ? ' (.env.local)' : ' (.env)'}.`
        : 'No .env or .env.local file found in the repo root.',
      fix: facts.hasEnvFile || facts.hasEnvLocalFile
        ? undefined
        : 'Create .env.local with required environment values (or provide them via the shell/CI environment).',
    })
  }

  checks.push({
    id: 'database-url',
    title: 'DATABASE_URL present',
    category: 'database',
    required: true,
    status: facts.databaseUrlPresent ? 'PASS' : 'FAIL',
    summary: facts.databaseUrlPresent ? 'DATABASE_URL is present in env.' : 'DATABASE_URL is missing.',
    fix: facts.databaseUrlPresent
      ? undefined
      : 'Set DATABASE_URL in .env.local or your runtime environment.',
  })

  checks.push({
    id: 'database-reachable',
    title: 'Database reachable',
    category: 'database',
    required: true,
    status: facts.databaseUrlPresent ? (facts.databaseReachable ? 'PASS' : 'FAIL') : 'WARN',
    summary: !facts.databaseUrlPresent
      ? 'Skipped because DATABASE_URL is missing.'
      : facts.databaseReachable
        ? 'DATABASE_URL is present and the app can query the database.'
        : 'Database connection failed.',
    fix: !facts.databaseUrlPresent
      ? 'Configure DATABASE_URL first, then re-run doctor.'
      : facts.databaseReachable
        ? undefined
        : `Verify database server accessibility and credentials${facts.databaseError ? ` (${facts.databaseError})` : ''}.`,
  })

  checks.push({
    id: 'prisma-client-generated',
    title: 'Prisma client generated',
    category: 'database',
    required: true,
    status: facts.prismaClientGenerated ? 'PASS' : 'FAIL',
    summary: facts.prismaClientGenerated
      ? 'Prisma client artifacts were found.'
      : 'Prisma client artifacts were not found.',
    fix: facts.prismaClientGenerated
      ? undefined
      : 'Run npm run db:generate to generate Prisma client artifacts.',
  })

  checks.push({
    id: 'store-exists',
    title: 'Store seeded',
    category: 'store_settings',
    required: true,
    status:
      facts.databaseReachable && facts.storeCount !== null
        ? facts.storeCount > 0
          ? 'PASS'
          : 'FAIL'
        : 'WARN',
    summary:
      facts.databaseReachable && facts.storeCount !== null
        ? facts.storeCount > 0
          ? `${facts.storeCount} store record(s) found.`
          : 'No store record found. Run bootstrap or setup before selling.'
        : 'Skipped because database check did not complete.',
    fix:
      facts.databaseReachable && facts.storeCount !== null
        ? facts.storeCount > 0
          ? undefined
          : 'Run npm run db:seed:bootstrap or create a store via setup flow before selling.'
        : 'Resolve database connectivity first.',
  })

  checks.push({
    id: 'owner-user-exists',
    title: 'Owner account exists',
    category: 'admin_owner',
    required: true,
    status:
      facts.databaseReachable && facts.ownerCount !== null
        ? facts.ownerCount > 0
          ? 'PASS'
          : 'FAIL'
        : 'WARN',
    summary:
      facts.databaseReachable && facts.ownerCount !== null
        ? facts.ownerCount > 0
          ? `${facts.ownerCount} OWNER user(s) found.`
          : 'No OWNER user found.'
        : 'Skipped because database check did not complete.',
    fix:
      facts.databaseReachable && facts.ownerCount !== null
        ? facts.ownerCount > 0
          ? undefined
          : 'Run npm run db:seed:bootstrap or create an OWNER user through setup tooling.'
        : 'Resolve database connectivity first.',
  })

  checks.push({
    id: 'store-settings',
    title: 'Store settings',
    category: 'store_settings',
    required: false,
    status: !facts.databaseReachable
      ? 'WARN'
      : facts.storeConfigured && facts.storeContactConfigured
        ? 'PASS'
        : facts.storeConfigured
          ? 'WARN'
          : 'FAIL',
    summary: !facts.databaseReachable
      ? 'Skipped because database check did not complete.'
      : facts.storeConfigured && facts.storeContactConfigured
        ? 'Store name and store contact email are configured.'
        : facts.storeConfigured
          ? 'Store exists but contact email is missing.'
          : 'Store settings are incomplete.',
    fix: !facts.databaseReachable
      ? 'Resolve database connectivity first.'
      : facts.storeConfigured && facts.storeContactConfigured
        ? undefined
        : facts.storeConfigured
          ? 'Set store contact email in Settings -> General.'
          : 'Create/configure store settings in the setup flow or Settings -> General.',
  })

  const jwtEvaluation = evaluateJwtSecret(facts.jwtSecret)
  checks.push({
    id: 'jwt-secret',
    title: 'JWT_SECRET strength',
    category: 'admin_owner',
    required: true,
    status: jwtEvaluation.status,
    summary: jwtEvaluation.summary,
    fix: jwtEvaluation.fix,
  })

  checks.push({
    id: 'stripe-keys',
    title: 'Stripe env keys found',
    category: 'stripe',
    required: true,
    status: facts.stripeSecretKeyPresent && facts.stripePublishableKeyPresent ? 'PASS' : 'FAIL',
    summary: facts.stripeSecretKeyPresent && facts.stripePublishableKeyPresent
      ? 'Stripe keys are present in env. Provider API verification has not been run from this screen.'
      : 'Missing Stripe secret key and/or publishable key.',
    fix: facts.stripeSecretKeyPresent && facts.stripePublishableKeyPresent
      ? undefined
      : 'Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.',
  })

  checks.push({
    id: 'stripe-webhook-secret',
    title: 'Stripe webhook secret found',
    category: 'stripe',
    required: true,
    status: facts.stripeWebhookSecretPresent ? 'PASS' : 'FAIL',
    summary: facts.stripeWebhookSecretPresent
      ? 'STRIPE_WEBHOOK_SECRET is present in env. Webhook endpoint verification has not been run from this screen.'
      : 'STRIPE_WEBHOOK_SECRET is missing.',
    fix: facts.stripeWebhookSecretPresent
      ? undefined
      : 'Set STRIPE_WEBHOOK_SECRET to the Stripe webhook signing secret for /api/webhooks/stripe.',
  })

  const retrySecretEvaluation = evaluateWebhookRetrySecret(facts.webhookRetrySecret)
  checks.push({
    id: 'webhook-retry-secret',
    title: 'WEBHOOK_RETRY_SECRET present',
    category: 'webhook_retry',
    required: true,
    status: retrySecretEvaluation.status,
    summary: retrySecretEvaluation.summary,
    fix: retrySecretEvaluation.fix,
  })

  checks.push({
    id: 'resend-api-or-preview',
    title: 'Email API key found',
    category: 'resend_email',
    required: false,
    status: facts.resendApiKeyPresent ? 'PASS' : 'WARN',
    summary: facts.resendApiKeyPresent
      ? 'RESEND_API_KEY is present. Send/API verification has not been run from this screen.'
      : 'RESEND_API_KEY is not set; preview mode is active and live provider sends are disabled.',
    fix: facts.resendApiKeyPresent
      ? undefined
      : 'Set RESEND_API_KEY to enable live provider sends (optional in local preview mode).',
  })

  if (facts.emailProviderWebhooksEnabled) {
    checks.push({
      id: 'resend-webhook-secret-enabled',
      title: 'Email webhook secret found',
      category: 'resend_email',
      required: true,
      status: facts.resendWebhookSecretPresent ? 'PASS' : 'FAIL',
      summary: facts.resendWebhookSecretPresent
        ? 'RESEND_WEBHOOK_SECRET is present for email-provider webhook verification.'
        : 'Live email sending may work, but bounce/complaint webhook verification is not configured.',
      fix: facts.resendWebhookSecretPresent
        ? undefined
        : 'Set RESEND_WEBHOOK_SECRET to verify webhook signatures on /api/webhooks/email-provider.',
    })
  } else {
    checks.push({
      id: 'resend-webhook-secret-enabled',
      title: 'Email webhook secret found',
      category: 'resend_email',
      required: false,
      status: facts.resendWebhookSecretPresent ? 'PASS' : 'WARN',
      summary: facts.resendWebhookSecretPresent
        ? 'RESEND_WEBHOOK_SECRET is configured.'
        : 'Email-provider webhook verification is not enabled; RESEND_WEBHOOK_SECRET is optional until webhook events are enabled.',
      fix: facts.resendWebhookSecretPresent
        ? undefined
        : 'If you enable provider webhooks, set RESEND_WEBHOOK_SECRET first.',
    })
  }

  const storeUrlEvaluation = evaluateStoreUrl(facts.nextPublicStoreUrl)
  checks.push({
    id: 'next-public-store-url',
    title: 'NEXT_PUBLIC_STORE_URL present',
    category: 'public_url',
    required: true,
    status: storeUrlEvaluation.status,
    summary: storeUrlEvaluation.summary,
    fix: storeUrlEvaluation.fix,
  })

  checks.push({
    id: 'vercel-deployment',
    title: 'Deployment env detected',
    category: 'deployment',
    required: false,
    status: facts.vercelEnvironmentDetected || facts.vercelUrlPresent ? 'PASS' : 'WARN',
    summary: facts.vercelEnvironmentDetected
      ? 'Running in a Vercel environment.'
      : facts.vercelUrlPresent
        ? 'Vercel URL is configured.'
        : 'No Vercel deployment markers detected in env.',
    fix: facts.vercelEnvironmentDetected || facts.vercelUrlPresent
      ? undefined
      : 'If deploying on Vercel, configure VERCEL_URL and deployment env vars in project settings.',
  })

  const passCount = checks.filter((check) => check.status === 'PASS').length
  const warnCount = checks.filter((check) => check.status === 'WARN').length
  const failCount = checks.filter((check) => check.status === 'FAIL').length
  const requiredFailCount = checks.filter((check) => check.required && check.status === 'FAIL').length

  return {
    checks,
    passCount,
    warnCount,
    failCount,
    requiredFailCount,
    ok: requiredFailCount === 0,
  }
}

export function deriveSafeNextActions(checks: SetupCheck[], limit = 6) {
  const actions = checks
    .filter((check) => check.status !== 'PASS' && check.fix)
    .map((check) => check.fix as string)

  return [...new Set(actions)].slice(0, limit)
}
