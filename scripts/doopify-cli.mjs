#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function loadEnvFiles(rootDir) {
  dotenv.config({ path: path.join(rootDir, '.env'), quiet: true })
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true, quiet: true })
}

function parseNodeMajor(version) {
  const match = /^v(\d+)/.exec(version)
  return match ? Number(match[1]) : null
}

function sanitizeErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:***@')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadSetupService() {
  const servicePath = path.join(repoRoot, 'src', 'server', 'services', 'setup.service.ts')

  try {
    return await import(servicePath)
  } catch {
    // Fall through to transpile fallback for older Node runtimes.
  }

  try {
    const tsModule = await import('typescript')
    const source = fs.readFileSync(servicePath, 'utf8')
    const transpiled = tsModule.transpileModule(source, {
      compilerOptions: {
        module: tsModule.ModuleKind.ESNext,
        target: tsModule.ScriptTarget.ES2020,
      },
      fileName: servicePath,
    })

    const encoded = Buffer.from(transpiled.outputText, 'utf8').toString('base64')
    return import(`data:text/javascript;base64,${encoded}`)
  } catch {
    return null
  }
}

function buildSetupDoctorReportFallback(facts) {
  const checks = []
  const add = (id, title, required, status, summary, fix) => checks.push({ id, title, required, status, summary, fix })
  const pass = (value) => (value ? 'PASS' : 'FAIL')
  const isWeak = (value) => /(change[-_]?me|example|default|test|password|secret|doopify)/i.test(value || '')

  add('node-version', 'Node version', true, facts.nodeMajorVersion >= facts.minimumNodeMajor ? 'PASS' : 'FAIL', facts.nodeMajorVersion >= facts.minimumNodeMajor ? `Node ${facts.nodeVersion} satisfies minimum v${facts.minimumNodeMajor}.` : `Node ${facts.nodeVersion} is below minimum v${facts.minimumNodeMajor}.`, `Upgrade Node.js to v${facts.minimumNodeMajor} or newer.`)
  add('npm-available', 'npm available', true, pass(facts.npmAvailable), facts.npmAvailable ? `npm is available${facts.npmVersion ? ` (${facts.npmVersion})` : ''}.` : 'npm command is not available.', 'Install npm and ensure it is available on PATH.')
  add('package-install-state', 'Package install state', true, pass(facts.dependenciesInstalled), facts.dependenciesInstalled ? 'Dependencies appear installed.' : `Missing dependencies: ${facts.missingDependencies.join(', ')}`, 'Run npm install, then re-run npm run doopify:doctor.')
  add('env-files', '.env / .env.local presence', false, facts.hasEnvFile || facts.hasEnvLocalFile ? 'PASS' : 'WARN', facts.hasEnvFile || facts.hasEnvLocalFile ? 'Env files detected.' : 'No .env or .env.local file found in the repo root.', 'Create .env.local with required environment values (or provide them via shell/CI environment).')
  add('database-url', 'DATABASE_URL present', true, pass(facts.databaseUrlPresent), facts.databaseUrlPresent ? 'DATABASE_URL is set.' : 'DATABASE_URL is missing.', 'Set DATABASE_URL in .env.local or your runtime environment.')
  add('database-reachable', 'Database reachable', true, facts.databaseUrlPresent ? pass(facts.databaseReachable) : 'WARN', !facts.databaseUrlPresent ? 'Skipped because DATABASE_URL is missing.' : facts.databaseReachable ? 'Database connection succeeded.' : 'Database connection failed.', facts.databaseReachable ? undefined : 'Verify database server accessibility and credentials.')
  add('prisma-client-generated', 'Prisma client generated', true, pass(facts.prismaClientGenerated), facts.prismaClientGenerated ? 'Prisma client artifacts were found.' : 'Prisma client artifacts were not found.', 'Run npm run db:generate to generate Prisma client artifacts.')
  add('store-exists', 'Store exists', true, facts.databaseReachable ? (facts.storeCount > 0 ? 'PASS' : 'FAIL') : 'WARN', facts.databaseReachable ? (facts.storeCount > 0 ? `${facts.storeCount} store record(s) found.` : 'No store records found.') : 'Skipped because database check did not complete.', 'Run npm run db:seed:bootstrap or create a store via setup flow.')
  add('owner-user-exists', 'Owner/admin user exists', true, facts.databaseReachable ? (facts.ownerCount > 0 ? 'PASS' : 'FAIL') : 'WARN', facts.databaseReachable ? (facts.ownerCount > 0 ? `${facts.ownerCount} OWNER user(s) found.` : 'No OWNER user found.') : 'Skipped because database check did not complete.', 'Run npm run db:seed:bootstrap or create an OWNER user through setup tooling.')

  const jwtStrong = Boolean(facts.jwtSecret) && facts.jwtSecret.length >= 32
  add('jwt-secret', 'JWT_SECRET strength', true, jwtStrong ? (isWeak(facts.jwtSecret) ? 'WARN' : 'PASS') : 'FAIL', !facts.jwtSecret ? 'JWT_SECRET is missing.' : jwtStrong ? 'JWT_SECRET is present and strong enough.' : `JWT_SECRET is too short (${facts.jwtSecret.length} characters).`, 'Set JWT_SECRET in .env.local to a random secret with at least 32 characters.')
  add('stripe-keys', 'Stripe keys present', true, facts.stripeSecretKeyPresent && facts.stripePublishableKeyPresent ? 'PASS' : 'FAIL', facts.stripeSecretKeyPresent && facts.stripePublishableKeyPresent ? 'Stripe secret and publishable keys are present.' : 'Missing Stripe secret key and/or publishable key.', 'Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.')
  add('stripe-webhook-secret', 'Stripe webhook secret present', true, pass(facts.stripeWebhookSecretPresent), facts.stripeWebhookSecretPresent ? 'STRIPE_WEBHOOK_SECRET is present.' : 'STRIPE_WEBHOOK_SECRET is missing.', 'Set STRIPE_WEBHOOK_SECRET for /api/webhooks/stripe.')

  const retryStrong = Boolean(facts.webhookRetrySecret) && facts.webhookRetrySecret.length >= 16
  add('webhook-retry-secret', 'WEBHOOK_RETRY_SECRET present', true, retryStrong ? (isWeak(facts.webhookRetrySecret) ? 'WARN' : 'PASS') : 'FAIL', !facts.webhookRetrySecret ? 'WEBHOOK_RETRY_SECRET is missing.' : retryStrong ? 'WEBHOOK_RETRY_SECRET is present.' : `WEBHOOK_RETRY_SECRET is too short (${facts.webhookRetrySecret.length} characters).`, 'Set WEBHOOK_RETRY_SECRET in .env.local to a random secret with at least 16 characters.')
  add('resend-api-or-preview', 'RESEND_API_KEY or preview mode', true, 'PASS', facts.resendApiKeyPresent ? 'RESEND_API_KEY is present.' : 'RESEND_API_KEY is not set; preview mode is active.', 'Set RESEND_API_KEY to enable live provider sends (optional in local preview mode).')
  add('resend-webhook-secret-enabled', 'RESEND_WEBHOOK_SECRET for email-provider webhooks', facts.emailProviderWebhooksEnabled, facts.emailProviderWebhooksEnabled ? pass(facts.resendWebhookSecretPresent) : facts.resendWebhookSecretPresent ? 'PASS' : 'WARN', facts.emailProviderWebhooksEnabled ? (facts.resendWebhookSecretPresent ? 'RESEND_WEBHOOK_SECRET is present for email-provider webhook verification.' : 'Email-provider webhooks appear enabled but RESEND_WEBHOOK_SECRET is missing.') : facts.resendWebhookSecretPresent ? 'RESEND_WEBHOOK_SECRET is configured.' : 'Email-provider webhook verification is not enabled; RESEND_WEBHOOK_SECRET is optional right now.', facts.emailProviderWebhooksEnabled ? 'Set RESEND_WEBHOOK_SECRET to verify webhook signatures on /api/webhooks/email-provider.' : 'If you enable provider webhooks, set RESEND_WEBHOOK_SECRET first.')

  let storeUrlStatus = 'FAIL'
  let storeUrlSummary = 'NEXT_PUBLIC_STORE_URL is missing.'
  if (facts.nextPublicStoreUrl) {
    try {
      const parsed = new URL(facts.nextPublicStoreUrl)
      storeUrlStatus = ['http:', 'https:'].includes(parsed.protocol) ? 'PASS' : 'FAIL'
      storeUrlSummary = storeUrlStatus === 'PASS' ? 'NEXT_PUBLIC_STORE_URL is present and valid.' : 'NEXT_PUBLIC_STORE_URL must use http:// or https://.'
    } catch {
      storeUrlStatus = 'FAIL'
      storeUrlSummary = 'NEXT_PUBLIC_STORE_URL is not a valid URL.'
    }
  }
  add('next-public-store-url', 'NEXT_PUBLIC_STORE_URL present', true, storeUrlStatus, storeUrlSummary, 'Set NEXT_PUBLIC_STORE_URL to your storefront base URL.')

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

function checkNpmAvailability() {
  const npmExecPath = process.env.npm_execpath
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, '--version'], {
        cwd: repoRoot,
        encoding: 'utf8',
      })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], {
        cwd: repoRoot,
        encoding: 'utf8',
      })

  const ok = result.status === 0 && !result.error

  return {
    available: ok,
    version: ok ? result.stdout.trim() : undefined,
  }
}

function checkDependenciesInstalled() {
  const required = [
    { name: 'node_modules', relativePath: 'node_modules' },
    { name: 'next', relativePath: 'node_modules/next/package.json' },
    { name: '@prisma/client', relativePath: 'node_modules/@prisma/client/package.json' },
    { name: 'prisma', relativePath: 'node_modules/prisma/package.json' },
  ]

  const missing = required
    .filter((entry) => !fs.existsSync(path.join(repoRoot, entry.relativePath)))
    .map((entry) => entry.name)

  return {
    installed: missing.length === 0,
    missing,
  }
}

async function checkDatabaseFacts(databaseUrlPresent, dependenciesInstalled) {
  if (!databaseUrlPresent || !dependenciesInstalled) {
    return {
      databaseReachable: false,
      databaseError: databaseUrlPresent ? 'Install dependencies before running DB checks.' : 'DATABASE_URL is missing.',
      storeCount: null,
      ownerCount: null,
    }
  }

  let prisma
  try {
    const prismaModule = await import('@prisma/client')
    const adapterModule = await import('@prisma/adapter-pg')
    const PrismaClient = prismaModule.PrismaClient
    const PrismaPg = adapterModule.PrismaPg

    const normalizedDatabaseUrl = (() => {
      try {
        const url = new URL(process.env.DATABASE_URL || '')
        const sslmode = url.searchParams.get('sslmode')
        if (sslmode && ['prefer', 'require', 'verify-ca'].includes(sslmode)) {
          url.searchParams.set('sslmode', 'verify-full')
          return url.toString()
        }
      } catch {
        return process.env.DATABASE_URL
      }
      return process.env.DATABASE_URL
    })()

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: normalizedDatabaseUrl }),
    })

    await prisma.$queryRawUnsafe('SELECT 1')

    const [storeCount, ownerCount] = await Promise.all([
      prisma.store.count(),
      prisma.user.count({ where: { role: 'OWNER', isActive: true } }),
    ])

    return {
      databaseReachable: true,
      storeCount,
      ownerCount,
    }
  } catch (error) {
    return {
      databaseReachable: false,
      databaseError: sanitizeErrorMessage(error),
      storeCount: null,
      ownerCount: null,
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {})
    }
  }
}

async function runDoctor() {
  loadEnvFiles(repoRoot)

  const setupService = await loadSetupService()
  const reportBuilder = setupService?.buildSetupDoctorReport || buildSetupDoctorReportFallback

  const nodeMajorVersion = parseNodeMajor(process.version)
  const npmCheck = checkNpmAvailability()
  const dependencyCheck = checkDependenciesInstalled()

  const hasEnvFile = fs.existsSync(path.join(repoRoot, '.env'))
  const hasEnvLocalFile = fs.existsSync(path.join(repoRoot, '.env.local'))

  const prismaClientGenerated =
    fs.existsSync(path.join(repoRoot, 'node_modules/.prisma/client/index.js')) &&
    fs.existsSync(path.join(repoRoot, 'node_modules/@prisma/client/index.js'))

  const databaseUrlPresent = Boolean(process.env.DATABASE_URL)
  const databaseFacts = await checkDatabaseFacts(databaseUrlPresent, dependencyCheck.installed)

  const facts = {
    nodeVersion: process.version,
    nodeMajorVersion,
    minimumNodeMajor: 20,
    npmAvailable: npmCheck.available,
    npmVersion: npmCheck.version,
    dependenciesInstalled: dependencyCheck.installed,
    missingDependencies: dependencyCheck.missing,
    hasEnvFile,
    hasEnvLocalFile,
    databaseUrlPresent,
    databaseReachable: databaseFacts.databaseReachable,
    databaseError: databaseFacts.databaseError,
    prismaClientGenerated,
    storeCount: databaseFacts.storeCount,
    ownerCount: databaseFacts.ownerCount,
    storeConfigured:
      typeof databaseFacts.storeCount === 'number'
        ? databaseFacts.storeCount > 0
        : null,
    storeContactConfigured:
      typeof databaseFacts.storeCount === 'number'
        ? databaseFacts.storeCount > 0
        : null,
    jwtSecret: process.env.JWT_SECRET,
    stripeSecretKeyPresent: Boolean(process.env.STRIPE_SECRET_KEY),
    stripePublishableKeyPresent: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    stripeWebhookSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    webhookRetrySecret: process.env.WEBHOOK_RETRY_SECRET,
    resendApiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    resendWebhookSecretPresent: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    emailProviderWebhooksEnabled: Boolean(process.env.RESEND_API_KEY || process.env.RESEND_WEBHOOK_SECRET),
    nextPublicStoreUrl: process.env.NEXT_PUBLIC_STORE_URL,
    vercelEnvironmentDetected: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
    vercelUrlPresent: Boolean(process.env.VERCEL_URL),
  }

  const report = reportBuilder(facts, { profile: 'cli' })

  if (!setupService?.buildSetupDoctorReport) {
    console.log('WARN setup service model could not be loaded directly; using CLI fallback model.')
    console.log('')
  }

  console.log('Doopify Doctor (read-only)')
  console.log('')

  for (const check of report.checks) {
    const scope = check.required ? 'required' : 'optional'
    console.log(`${check.status.padEnd(4)} ${check.title} (${scope})`)
    console.log(`  ${check.summary}`)
    if (check.fix && check.status !== 'PASS') {
      console.log(`  Fix: ${check.fix}`)
    }
    console.log('')
  }

  console.log(`Summary: PASS ${report.passCount}  WARN ${report.warnCount}  FAIL ${report.failCount}`)

  if (!report.ok) {
    console.error(`Required checks failed: ${report.requiredFailCount}`)
    process.exitCode = 1
    return
  }

  process.exitCode = 0
}

async function main() {
  const command = process.argv[2]

  if (command !== 'doctor') {
    console.error('Usage: node scripts/doopify-cli.mjs doctor')
    process.exitCode = 1
    return
  }

  await runDoctor()
}

main().catch((error) => {
  console.error('Doopify CLI failed:', sanitizeErrorMessage(error))
  process.exitCode = 1
})
