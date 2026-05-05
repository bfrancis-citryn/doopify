import crypto from 'node:crypto'
import type { UserRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import { decrypt, encrypt } from '@/server/utils/crypto'

const TOTP_DIGITS = 6
const TOTP_PERIOD_SECONDS = 30
const TOTP_ALLOWED_WINDOW_STEPS = 1
const MFA_CHALLENGE_TTL_MINUTES = 10
const MFA_CHALLENGE_MAX_ATTEMPTS = 8
const OWNER_MFA_GRACE_PERIOD_DAYS_DEFAULT = 14
const MFA_RECOVERY_CODES_COUNT = 10
const TOTP_ISSUER = 'Doopify'

type AuthLikeUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
}

type ChallengeContext = {
  ip?: string | null
  userAgent?: string | null
}

function normalizeCode(input: string) {
  return input.trim().replace(/[\s-]/g, '')
}

function ownerMfaGracePeriodDays() {
  const configured = Number.parseInt(String(process.env.OWNER_MFA_GRACE_PERIOD_DAYS ?? ''), 10)
  if (!Number.isFinite(configured)) return OWNER_MFA_GRACE_PERIOD_DAYS_DEFAULT
  return Math.max(0, Math.min(365, configured))
}

function base32Encode(input: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let output = ''
  let buffer = 0
  let bitsLeft = 0

  for (const byte of input) {
    buffer = (buffer << 8) | byte
    bitsLeft += 8

    while (bitsLeft >= 5) {
      const index = (buffer >>> (bitsLeft - 5)) & 31
      output += alphabet[index]
      bitsLeft -= 5
    }
  }

  if (bitsLeft > 0) {
    const index = (buffer << (5 - bitsLeft)) & 31
    output += alphabet[index]
  }

  return output
}

function base32Decode(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let buffer = 0
  let bitsLeft = 0
  const bytes: number[] = []

  for (const char of clean) {
    const value = alphabet.indexOf(char)
    if (value < 0) {
      throw new Error('Invalid TOTP secret format')
    }
    buffer = (buffer << 5) | value
    bitsLeft += 5

    if (bitsLeft >= 8) {
      bytes.push((buffer >>> (bitsLeft - 8)) & 255)
      bitsLeft -= 8
    }
  }

  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number) {
  const counterBuffer = Buffer.alloc(8)
  let value = BigInt(counter)
  for (let i = 7; i >= 0; i -= 1) {
    counterBuffer[i] = Number(value & BigInt(255))
    value >>= BigInt(8)
  }

  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

function verifyTotp(secretBase32: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false

  const secret = base32Decode(secretBase32)
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS)

  for (let offset = -TOTP_ALLOWED_WINDOW_STEPS; offset <= TOTP_ALLOWED_WINDOW_STEPS; offset += 1) {
    if (hotp(secret, counter + offset) === code) {
      return true
    }
  }

  return false
}

function buildOtpAuthUri(secret: string, email: string) {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${email}`)
  const issuer = encodeURIComponent(TOTP_ISSUER)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20))
}

function generateRecoveryCodes() {
  const codes: string[] = []
  while (codes.length < MFA_RECOVERY_CODES_COUNT) {
    const partA = crypto.randomBytes(2).toString('hex').toUpperCase()
    const partB = crypto.randomBytes(2).toString('hex').toUpperCase()
    codes.push(`${partA}-${partB}`)
  }
  return codes
}

function hashRecoveryCode(code: string) {
  const normalized = normalizeCode(code).toUpperCase()
  return crypto.createHash('sha256').update(`doopify:mfa:${normalized}:${process.env.JWT_SECRET ?? ''}`).digest('hex')
}

function sanitizeRecoveryCodeForAudit(code: string) {
  const normalized = normalizeCode(code).toUpperCase()
  if (normalized.length <= 4) return '[REDACTED]'
  return `****${normalized.slice(-4)}`
}

async function requireOwnerMfaUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      mfaTotpSecretEnc: true,
      mfaTotpPendingSecretEnc: true,
      mfaEnabledAt: true,
      mfaRecoveryCodesHash: true,
      mfaGracePeriodEndsAt: true,
    },
  })

  if (!user) throw new Error('User not found')
  if (user.role !== 'OWNER') throw new Error('Only owners can manage MFA settings')
  return user
}

export async function ensureOwnerMfaGracePeriod(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      mfaEnabledAt: true,
      mfaGracePeriodEndsAt: true,
    },
  })

  if (!user || user.role !== 'OWNER' || user.mfaEnabledAt) {
    return null
  }

  if (user.mfaGracePeriodEndsAt) {
    return user.mfaGracePeriodEndsAt
  }

  const endsAt = new Date(Date.now() + ownerMfaGracePeriodDays() * 24 * 60 * 60 * 1000)
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaGracePeriodEndsAt: endsAt },
  })

  return endsAt
}

export async function getOwnerMfaStatus(userId: string) {
  const user = await requireOwnerMfaUser(userId)

  return {
    enabled: Boolean(user.mfaEnabledAt && user.mfaTotpSecretEnc),
    pendingEnrollment: Boolean(user.mfaTotpPendingSecretEnc),
    enabledAt: user.mfaEnabledAt,
    gracePeriodEndsAt: user.mfaGracePeriodEndsAt,
    recoveryCodesRemaining: user.mfaRecoveryCodesHash.length,
  }
}

export async function startOwnerMfaEnrollment(userId: string) {
  const user = await requireOwnerMfaUser(userId)
  const secret = generateTotpSecret()
  const now = new Date()
  const gracePeriodEndsAt =
    user.mfaGracePeriodEndsAt ?? new Date(now.getTime() + ownerMfaGracePeriodDays() * 24 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaTotpPendingSecretEnc: encrypt(secret),
      ...(user.mfaGracePeriodEndsAt ? {} : { mfaGracePeriodEndsAt: gracePeriodEndsAt }),
    },
  })

  return {
    secret,
    otpAuthUri: buildOtpAuthUri(secret, user.email),
    issuer: TOTP_ISSUER,
    accountName: user.email,
    gracePeriodEndsAt,
  }
}

export async function verifyOwnerMfaEnrollment(userId: string, code: string, actor?: AuthLikeUser | null) {
  const user = await requireOwnerMfaUser(userId)
  if (!user.mfaTotpPendingSecretEnc) {
    throw new Error('No pending MFA enrollment was found for this account')
  }

  const normalizedCode = normalizeCode(code)
  const pendingSecret = decrypt(user.mfaTotpPendingSecretEnc)
  if (!verifyTotp(pendingSecret, normalizedCode)) {
    throw new Error('Invalid MFA code')
  }

  const recoveryCodes = generateRecoveryCodes()
  const recoveryCodeHashes = recoveryCodes.map((entry) => hashRecoveryCode(entry))
  const enabledAt = new Date()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaTotpSecretEnc: encrypt(pendingSecret),
      mfaTotpPendingSecretEnc: null,
      mfaEnabledAt: enabledAt,
      mfaRecoveryCodesHash: recoveryCodeHashes,
      mfaGracePeriodEndsAt: null,
    },
  })

  await recordAuditLogBestEffort({
    action: 'auth.owner_mfa_enabled',
    actor: actor ? auditActorFromUser(actor) : { actorType: 'SYSTEM', actorId: user.id, actorEmail: user.email },
    resource: { type: 'User', id: user.id },
    summary: `Owner MFA enabled for ${user.email}`,
    snapshot: { recoveryCodesCount: recoveryCodes.length, method: 'TOTP' },
    redactions: ['mfaTotpSecret', 'mfaRecoveryCodesHash', 'recoveryCodes'],
  })

  return {
    enabledAt,
    recoveryCodes,
    recoveryCodesRemaining: recoveryCodes.length,
  }
}

export async function regenerateOwnerRecoveryCodes(userId: string, actor?: AuthLikeUser | null) {
  const user = await requireOwnerMfaUser(userId)
  if (!user.mfaTotpSecretEnc || !user.mfaEnabledAt) {
    throw new Error('MFA is not enabled for this account')
  }

  const recoveryCodes = generateRecoveryCodes()
  const recoveryCodeHashes = recoveryCodes.map((entry) => hashRecoveryCode(entry))

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaRecoveryCodesHash: recoveryCodeHashes,
    },
  })

  await recordAuditLogBestEffort({
    action: 'auth.owner_mfa_recovery_codes_regenerated',
    actor: actor ? auditActorFromUser(actor) : { actorType: 'SYSTEM', actorId: user.id, actorEmail: user.email },
    resource: { type: 'User', id: user.id },
    summary: `Owner MFA recovery codes regenerated for ${user.email}`,
    snapshot: { recoveryCodesCount: recoveryCodes.length },
    redactions: ['mfaRecoveryCodesHash', 'recoveryCodes'],
  })

  return {
    recoveryCodes,
    recoveryCodesRemaining: recoveryCodes.length,
  }
}

export async function disableOwnerMfa(userId: string, actor?: AuthLikeUser | null) {
  const user = await requireOwnerMfaUser(userId)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaTotpSecretEnc: null,
      mfaTotpPendingSecretEnc: null,
      mfaEnabledAt: null,
      mfaRecoveryCodesHash: [],
    },
  })

  await recordAuditLogBestEffort({
    action: 'auth.owner_mfa_disabled',
    actor: actor ? auditActorFromUser(actor) : { actorType: 'SYSTEM', actorId: user.id, actorEmail: user.email },
    resource: { type: 'User', id: user.id },
    summary: `Owner MFA disabled for ${user.email}`,
    snapshot: { method: 'TOTP' },
    redactions: ['mfaTotpSecret', 'mfaRecoveryCodesHash'],
  })
}

export function shouldChallengeOwnerOnLogin(user: {
  role: UserRole
  mfaTotpSecretEnc: string | null
  mfaEnabledAt: Date | null
}) {
  return user.role === 'OWNER' && Boolean(user.mfaEnabledAt && user.mfaTotpSecretEnc)
}

export async function beginOwnerMfaLoginChallenge(
  userId: string,
  context?: ChallengeContext
): Promise<{ challengeId: string; expiresAt: Date }> {
  const user = await requireOwnerMfaUser(userId)
  if (!user.mfaTotpSecretEnc || !user.mfaEnabledAt) {
    throw new Error('MFA is not enabled for this owner account')
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MINUTES * 60 * 1000)

  await prisma.mfaLoginChallenge.deleteMany({
    where: {
      userId: user.id,
      OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
    },
  })

  const challenge = await prisma.mfaLoginChallenge.create({
    data: {
      userId: user.id,
      expiresAt,
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  })

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
  }
}

export async function verifyOwnerMfaLoginChallenge(challengeId: string, code: string) {
  const challenge = await prisma.mfaLoginChallenge.findUnique({
    where: { id: challengeId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          mfaTotpSecretEnc: true,
          mfaEnabledAt: true,
          mfaRecoveryCodesHash: true,
        },
      },
    },
  })

  if (!challenge || !challenge.user || !challenge.user.isActive || challenge.user.role !== 'OWNER') {
    throw new Error('Invalid MFA challenge')
  }

  if (challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    throw new Error('MFA challenge expired')
  }

  if (challenge.attemptCount >= MFA_CHALLENGE_MAX_ATTEMPTS) {
    throw new Error('Too many MFA attempts for this challenge')
  }

  if (!challenge.user.mfaTotpSecretEnc || !challenge.user.mfaEnabledAt) {
    throw new Error('Owner MFA is not enabled')
  }

  const normalizedCode = normalizeCode(code)
  const secret = decrypt(challenge.user.mfaTotpSecretEnc)

  const isTotpValid = verifyTotp(secret, normalizedCode)
  const recoveryCodeHash = hashRecoveryCode(normalizedCode)
  const usedRecoveryCodeIndex = challenge.user.mfaRecoveryCodesHash.findIndex(
    (entry) => entry === recoveryCodeHash
  )
  const usedRecoveryCode = !isTotpValid && usedRecoveryCodeIndex >= 0

  if (!isTotpValid && !usedRecoveryCode) {
    await prisma.mfaLoginChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: { increment: 1 },
      },
    })
    throw new Error('Invalid MFA code')
  }

  const remainingRecoveryCodes = challenge.user.mfaRecoveryCodesHash.filter(
    (_entry, index) => index !== usedRecoveryCodeIndex
  )

  await prisma.$transaction(async (tx) => {
    await tx.mfaLoginChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: new Date(),
      },
    })

    if (usedRecoveryCode) {
      await tx.user.update({
        where: { id: challenge.user.id },
        data: {
          mfaRecoveryCodesHash: remainingRecoveryCodes,
        },
      })
    }
  })

  if (usedRecoveryCode) {
    await recordAuditLogBestEffort({
      action: 'auth.owner_mfa_recovery_code_used',
      actor: {
        actorType: 'STAFF',
        actorId: challenge.user.id,
        actorEmail: challenge.user.email,
        actorRole: challenge.user.role,
      },
      resource: { type: 'User', id: challenge.user.id },
      summary: `Owner MFA recovery code used for ${challenge.user.email}`,
      snapshot: {
        recoveryCodesRemaining: remainingRecoveryCodes.length,
        lastRecoveryCodeSuffix: sanitizeRecoveryCodeForAudit(normalizedCode),
      },
      redactions: ['recoveryCode', 'mfaRecoveryCodesHash'],
    })
  }

  return {
    user: {
      id: challenge.user.id,
      email: challenge.user.email,
      firstName: challenge.user.firstName,
      lastName: challenge.user.lastName,
      role: challenge.user.role,
    },
    usedRecoveryCode,
    recoveryCodesRemaining: usedRecoveryCode
      ? remainingRecoveryCodes.length
      : challenge.user.mfaRecoveryCodesHash.length,
  }
}
