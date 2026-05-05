import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mfaLoginChallenge: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  txChallengeUpdate: vi.fn(),
  txUserUpdate: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
  auditActorFromUser: vi.fn((user) => ({
    actorType: 'STAFF',
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
  })),
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => (value.startsWith('enc:') ? value.slice(4) : value)),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/services/audit-log.service', () => ({
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
  auditActorFromUser: mocks.auditActorFromUser,
}))
vi.mock('@/server/utils/crypto', () => ({
  encrypt: mocks.encrypt,
  decrypt: mocks.decrypt,
}))

import {
  beginOwnerMfaLoginChallenge,
  startOwnerMfaEnrollment,
  verifyOwnerMfaEnrollment,
  verifyOwnerMfaLoginChallenge,
} from './mfa.service'

function base32Decode(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = input.toUpperCase().replace(/=+$/g, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of clean) {
    const index = alphabet.indexOf(char)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

function totp(secretBase32: string, atMs: number) {
  const secret = base32Decode(secretBase32)
  const counter = Math.floor(atMs / 1000 / 30)
  const counterBuffer = Buffer.alloc(8)
  let value = BigInt(counter)
  for (let i = 7; i >= 0; i -= 1) {
    counterBuffer[i] = Number(value & BigInt(255))
    value >>= BigInt(8)
  }
  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 15
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

function recoveryHash(code: string) {
  const normalized = code.replace(/[\s-]/g, '').toUpperCase()
  return crypto.createHash('sha256').update(`doopify:mfa:${normalized}:${process.env.JWT_SECRET ?? ''}`).digest('hex')
}

describe('mfa service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('JWT_SECRET', 'mfa-test-secret')

    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        mfaLoginChallenge: { update: mocks.txChallengeUpdate },
        user: { update: mocks.txUserUpdate },
      })
    )
  })

  it('starts owner MFA enrollment and returns an otpauth URI', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      role: 'OWNER',
      mfaTotpSecretEnc: null,
      mfaTotpPendingSecretEnc: null,
      mfaEnabledAt: null,
      mfaRecoveryCodesHash: [],
      mfaGracePeriodEndsAt: null,
    })
    mocks.prisma.user.update.mockResolvedValue({ id: 'owner-1' })

    const enrollment = await startOwnerMfaEnrollment('owner-1')

    expect(enrollment.secret).toMatch(/^[A-Z2-7]+$/)
    expect(enrollment.otpAuthUri).toContain('otpauth://totp/')
    expect(enrollment.otpAuthUri).toContain('issuer=Doopify')
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'owner-1' },
        data: expect.objectContaining({
          mfaTotpPendingSecretEnc: expect.any(String),
        }),
      })
    )
  })

  it('verifies owner MFA enrollment and returns recovery codes', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-05-05T12:00:00.000Z')
    vi.setSystemTime(now)

    const secret = 'JBSWY3DPEHPK3PXP'
    const code = totp(secret, now.getTime())

    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      role: 'OWNER',
      mfaTotpSecretEnc: null,
      mfaTotpPendingSecretEnc: `enc:${secret}`,
      mfaEnabledAt: null,
      mfaRecoveryCodesHash: [],
      mfaGracePeriodEndsAt: null,
    })
    mocks.prisma.user.update.mockResolvedValue({ id: 'owner-1' })
    mocks.recordAuditLogBestEffort.mockResolvedValue(null)

    const result = await verifyOwnerMfaEnrollment('owner-1', code, {
      id: 'owner-1',
      email: 'owner@example.com',
      firstName: null,
      lastName: null,
      role: 'OWNER',
    })

    expect(result.recoveryCodes).toHaveLength(10)
    expect(result.recoveryCodesRemaining).toBe(10)
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'owner-1' },
        data: expect.objectContaining({
          mfaEnabledAt: expect.any(Date),
          mfaRecoveryCodesHash: expect.arrayContaining([expect.any(String)]),
        }),
      })
    )
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('verifies a recovery-code login challenge and consumes the used recovery code', async () => {
    const recoveryCode = 'A1B2-C3D4'
    const recoveryCodeHash = recoveryHash(recoveryCode)

    mocks.prisma.mfaLoginChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: 'owner-1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 0,
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: 'Olivia',
        lastName: 'Owner',
        role: 'OWNER',
        isActive: true,
        mfaTotpSecretEnc: 'enc:JBSWY3DPEHPK3PXP',
        mfaEnabledAt: new Date(Date.now() - 60_000),
        mfaRecoveryCodesHash: [recoveryCodeHash],
      },
    })
    mocks.txChallengeUpdate.mockResolvedValue({ id: 'challenge-1' })
    mocks.txUserUpdate.mockResolvedValue({ id: 'owner-1' })
    mocks.recordAuditLogBestEffort.mockResolvedValue(null)

    const result = await verifyOwnerMfaLoginChallenge('challenge-1', recoveryCode)

    expect(result.usedRecoveryCode).toBe(true)
    expect(result.recoveryCodesRemaining).toBe(0)
    expect(mocks.txChallengeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge-1' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      })
    )
    expect(mocks.txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'owner-1' },
        data: expect.objectContaining({ mfaRecoveryCodesHash: [] }),
      })
    )
  })

  it('creates expiring owner MFA login challenges', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      role: 'OWNER',
      mfaTotpSecretEnc: 'enc:JBSWY3DPEHPK3PXP',
      mfaTotpPendingSecretEnc: null,
      mfaEnabledAt: new Date(),
      mfaRecoveryCodesHash: [],
      mfaGracePeriodEndsAt: null,
    })
    mocks.prisma.mfaLoginChallenge.deleteMany.mockResolvedValue({ count: 0 })
    mocks.prisma.mfaLoginChallenge.create.mockResolvedValue({
      id: 'challenge-1',
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })

    const challenge = await beginOwnerMfaLoginChallenge('owner-1', { ip: '127.0.0.1' })

    expect(challenge.challengeId).toBe('challenge-1')
    expect(challenge.expiresAt).toBeInstanceOf(Date)
  })
})
