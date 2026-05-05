#!/usr/bin/env node
/**
 * doopify:reset-owner — Owner account recovery CLI
 *
 * Usage:
 *   npm run doopify:reset-owner
 *
 * What it does:
 *   1. Connects to the database via DATABASE_URL.
 *   2. If no OWNER exists, creates one (bootstraps).
 *   3. If an OWNER exists, resets their password.
 *   4. Invalidates all existing sessions for the affected account.
 *   5. Never prints a password hash or secret to stdout.
 *
 * Requires:
 *   - DATABASE_URL in environment or .env / .env.local
 *   - bcryptjs installed (already a project dependency)
 */

import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

// Load env files
dotenv.config({ path: path.join(repoRoot, '.env.local') })
dotenv.config({ path: path.join(repoRoot, '.env') })

const { PrismaClient } = await import('@prisma/client')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[reset-owner] ERROR: DATABASE_URL is not set. Cannot connect to the database.')
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function question(prompt) {
  return rl.question(prompt)
}

async function getPasswordSecurely(label) {
  // Node's readline doesn't support hidden input natively; instruct the user.
  console.log(`\n  Note: characters will be visible. Run in a private terminal if needed.`)
  const pw = await question(`  ${label}: `)
  return pw.trim()
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function main() {
  console.log('\n  Doopify — Owner Account Recovery\n  ─────────────────────────────────')

  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })

  try {
    // Check connectivity
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    console.error('\n  [reset-owner] ERROR: Cannot connect to database.', err.message)
    await prisma.$disconnect()
    rl.close()
    process.exit(1)
  }

  // Find existing active owners
  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    select: { id: true, email: true, firstName: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  let targetUser = null

  if (owners.length === 0) {
    console.log('\n  No OWNER account exists. Creating the first owner.\n')

    const email = await question('  Owner email: ')
    if (!validateEmail(email.trim())) {
      console.error('  Invalid email address.')
      rl.close()
      await prisma.$disconnect()
      process.exit(1)
    }

    const password = await getPasswordSecurely('Owner password (min 8 chars)')
    const confirm = await getPasswordSecurely('Confirm password')

    if (password !== confirm) {
      console.error('\n  Passwords do not match. Aborting.')
      rl.close()
      await prisma.$disconnect()
      process.exit(1)
    }
    if (password.length < 8) {
      console.error('\n  Password must be at least 8 characters. Aborting.')
      rl.close()
      await prisma.$disconnect()
      process.exit(1)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      console.error(`\n  A user with email ${normalizedEmail} already exists (role: ${existing.role}). Cannot bootstrap.`)
      rl.close()
      await prisma.$disconnect()
      process.exit(1)
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const created = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, role: 'OWNER', isActive: true },
      select: { id: true, email: true },
    })

    console.log(`\n  ✓ Owner account created: ${created.email}`)
    console.log('  Sign in at /login with the credentials you just set.\n')
    rl.close()
    await prisma.$disconnect()
    return
  }

  // Existing owners found — select which to reset
  if (owners.length === 1) {
    targetUser = owners[0]
    console.log(`\n  Found OWNER: ${targetUser.email}${targetUser.isActive ? '' : ' [disabled]'}`)
  } else {
    console.log('\n  Multiple OWNER accounts found:')
    owners.forEach((o, i) => {
      console.log(`    [${i + 1}] ${o.email}${o.isActive ? '' : ' [disabled]'}`)
    })
    const choice = await question('\n  Enter number to reset (or press Enter for first): ')
    const idx = parseInt(choice.trim(), 10)
    targetUser = owners[Number.isNaN(idx) || idx < 1 || idx > owners.length ? 0 : idx - 1]
  }

  console.log(`\n  Resetting password for: ${targetUser.email}\n`)
  const password = await getPasswordSecurely('New password (min 8 chars)')
  const confirm = await getPasswordSecurely('Confirm new password')

  if (password !== confirm) {
    console.error('\n  Passwords do not match. Aborting.')
    rl.close()
    await prisma.$disconnect()
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('\n  Password must be at least 8 characters. Aborting.')
    rl.close()
    await prisma.$disconnect()
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUser.id },
      data: { passwordHash, isActive: true },
    })
    await tx.session.deleteMany({ where: { userId: targetUser.id } })
    // Also clear any pending password resets
    await tx.passwordReset.deleteMany({ where: { userId: targetUser.id } })
  })

  console.log(`\n  ✓ Password reset for: ${targetUser.email}`)
  console.log('  All existing sessions have been revoked.')
  console.log('  Sign in at /login with the new password.\n')

  rl.close()
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('\n  [reset-owner] Unexpected error:', err.message)
  process.exit(1)
})
