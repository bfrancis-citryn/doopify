import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'test_jwt_secret_for_tests_only_123456',
    NODE_ENV: 'test' as 'test' | 'production' | 'development',
    SETUP_TOKEN: undefined as string | undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined,
    RESEND_API_KEY: undefined,
    RESEND_WEBHOOK_SECRET: undefined,
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_SECURE: undefined,
    SMTP_USERNAME: undefined,
    SMTP_PASSWORD: undefined,
    SMTP_FROM_EMAIL: undefined,
    SHIPPO_API_KEY: undefined,
    EASYPOST_API_KEY: undefined,
    EASYPOST_WEBHOOK_SECRET: undefined,
    SHIPPO_WEBHOOK_SECRET: undefined,
    NEXT_PUBLIC_STORE_URL: undefined,
    WEBHOOK_RETRY_SECRET: undefined,
    JOB_RUNNER_SECRET: undefined,
    ABANDONED_CHECKOUT_SECRET: undefined,
  },
  prisma: {
    user: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    userInvite: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    mfaLoginChallenge: {
      deleteMany: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ env: mocks.env }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/services/audit-log.service', () => ({
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))
vi.mock('bcryptjs', () => ({
  default: {
    hash: mocks.bcryptHash,
    compare: mocks.bcryptCompare,
  },
}))

import {
  acceptPasswordReset,
  acceptTeamInvite,
  activeOwnerExists,
  bootstrapOwner,
  createTeamUser,
  disableTeamUser,
  getUserSessions,
  inviteTeamUser,
  listPendingInvites,
  listTeamUsers,
  reactivateTeamUser,
  requestPasswordReset,
  resendTeamInvite,
  revokeTeamInvite,
  revokeUserSessions,
  deleteDisabledTeamUser,
  updateTeamUserProfile,
  updateTeamUserRole,
} from './team.service'

describe('team service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.env.SETUP_TOKEN = undefined
    mocks.env.NODE_ENV = 'test'
    mocks.bcryptHash.mockResolvedValue('hashed_value')
    mocks.bcryptCompare.mockResolvedValue(false)
    mocks.prisma.$transaction.mockImplementation(async (cb: any) => cb(mocks.prisma))
    mocks.prisma.session.deleteMany.mockResolvedValue({ count: 0 })
    mocks.prisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 })
    mocks.prisma.mfaLoginChallenge.deleteMany.mockResolvedValue({ count: 0 })
    mocks.recordAuditLogBestEffort.mockResolvedValue(null)
  })

  // ── activeOwnerExists ───────────────────────────────────────────────────────

  describe('activeOwnerExists', () => {
    it('returns true when an active owner exists', async () => {
      mocks.prisma.user.count.mockResolvedValue(1)
      expect(await activeOwnerExists()).toBe(true)
    })

    it('returns false when no active owner exists', async () => {
      mocks.prisma.user.count.mockResolvedValue(0)
      expect(await activeOwnerExists()).toBe(false)
    })
  })

  // ── bootstrapOwner ──────────────────────────────────────────────────────────

  describe('bootstrapOwner', () => {
    it('creates the first owner when no owner exists', async () => {
      mocks.prisma.user.findFirst.mockResolvedValue(null)
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'user_1',
        email: 'owner@example.com',
        firstName: 'Ada',
        lastName: 'Owner',
        role: 'OWNER',
      })

      const result = await bootstrapOwner({
        email: 'owner@example.com',
        password: 'securepassword1',
        firstName: 'Ada',
        lastName: 'Owner',
      })

      expect(mocks.bcryptHash).toHaveBeenCalledWith('securepassword1', 12)
      expect(mocks.prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'owner@example.com',
            role: 'OWNER',
            isActive: true,
          }),
        })
      )
      expect(result.role).toBe('OWNER')
    })

    it('rejects bootstrap when an owner already exists', async () => {
      mocks.prisma.user.findFirst.mockResolvedValue({ id: 'existing_owner' })

      await expect(
        bootstrapOwner({ email: 'new@example.com', password: 'securepassword1' })
      ).rejects.toThrow('An owner account already exists')
    })

    it('rejects passwords shorter than 8 characters', async () => {
      mocks.prisma.user.findFirst.mockResolvedValue(null)

      await expect(
        bootstrapOwner({ email: 'owner@example.com', password: 'short' })
      ).rejects.toThrow('Password must be at least 8 characters')
    })

    it('rejects invalid setup token when SETUP_TOKEN env is configured', async () => {
      mocks.env.SETUP_TOKEN = 'correct-token'
      mocks.prisma.user.findFirst.mockResolvedValue(null)

      await expect(
        bootstrapOwner({ email: 'owner@example.com', password: 'securepassword1', setupToken: 'wrong-token' })
      ).rejects.toThrow('Invalid setup token')
    })

    it('accepts valid setup token when SETUP_TOKEN env is configured', async () => {
      mocks.env.SETUP_TOKEN = 'correct-token'
      mocks.prisma.user.findFirst.mockResolvedValue(null)
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'user_token',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
        role: 'OWNER',
      })

      const result = await bootstrapOwner({
        email: 'owner@example.com',
        password: 'securepassword1',
        setupToken: 'correct-token',
      })

      expect(result.role).toBe('OWNER')
    })

    it('allows bootstrap without token when SETUP_TOKEN env is not configured', async () => {
      mocks.env.SETUP_TOKEN = undefined
      mocks.prisma.user.findFirst.mockResolvedValue(null)
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'user_no_token',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
        role: 'OWNER',
      })

      await expect(
        bootstrapOwner({ email: 'owner@example.com', password: 'securepassword1' })
      ).resolves.toMatchObject({ role: 'OWNER' })
    })

    it('hashes the password and never stores it in plain text', async () => {
      mocks.prisma.user.findFirst.mockResolvedValue(null)
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'user_hash',
        email: 'hash@example.com',
        firstName: null,
        lastName: null,
        role: 'OWNER',
      })

      await bootstrapOwner({ email: 'hash@example.com', password: 'myPassword123' })

      expect(mocks.bcryptHash).toHaveBeenCalledWith('myPassword123', 12)
      const createCall = mocks.prisma.user.create.mock.calls[0][0]
      expect(createCall.data.passwordHash).toBe('hashed_value')
      expect(createCall.data).not.toHaveProperty('password')
    })
  })

  // ── inviteTeamUser ──────────────────────────────────────────────────────────

  describe('createTeamUser', () => {
    it('creates an ADMIN user when requested by an owner-managed flow', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'admin_1',
        email: 'admin@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
      })

      const created = await createTeamUser({
        email: 'admin@example.com',
        password: 'securepassword1',
        firstName: 'Ada',
        lastName: 'Admin',
        role: 'ADMIN',
      })

      expect(created.role).toBe('ADMIN')
      expect(mocks.prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'admin@example.com',
            role: 'ADMIN',
          }),
        })
      )
    })

    it('returns a clear error when database UserRole enum is missing ADMIN', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockRejectedValue(
        new Error('invalid input value for enum "UserRole": "ADMIN"')
      )

      await expect(
        createTeamUser({
          email: 'admin@example.com',
          password: 'securepassword1',
          role: 'ADMIN',
        })
      ).rejects.toThrow('Team role ADMIN is not available in the database schema')
    })
  })

  // ── inviteTeamUser ──────────────────────────────────────────────────────────

  describe('inviteTeamUser', () => {
    it('creates a hashed invite token for a valid email and role', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.userInvite.findFirst.mockResolvedValue(null)
      mocks.prisma.userInvite.create.mockResolvedValue({
        id: 'invite_1',
        email: 'staff@example.com',
        role: 'STAFF',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        invitedById: 'owner_1',
      })

      const { invite, rawToken } = await inviteTeamUser({
        email: 'staff@example.com',
        role: 'STAFF',
        invitedById: 'owner_1',
      })

      expect(rawToken).toBeTruthy()
      expect(rawToken.length).toBeGreaterThan(32)
      expect(mocks.bcryptHash).toHaveBeenCalledWith(rawToken, 10)

      const createCall = mocks.prisma.userInvite.create.mock.calls[0][0]
      expect(createCall.data.tokenHash).toBe('hashed_value')
      expect(createCall.data).not.toHaveProperty('token')
      expect(invite.email).toBe('staff@example.com')
    })

    it('rejects invite when user with email already exists', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'existing_user' })

      await expect(
        inviteTeamUser({ email: 'existing@example.com', role: 'STAFF' })
      ).rejects.toThrow('A user with this email already exists')
    })

    it('rejects invite when a pending invite already exists for the email', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.userInvite.findFirst.mockResolvedValue({ id: 'existing_invite' })

      await expect(
        inviteTeamUser({ email: 'pending@example.com', role: 'STAFF' })
      ).rejects.toThrow('pending invite for this email already exists')
    })
  })

  // ── acceptTeamInvite ────────────────────────────────────────────────────────

  describe('acceptTeamInvite', () => {
    it('creates a user and deletes the invite on valid token', async () => {
      mocks.prisma.userInvite.findMany.mockResolvedValue([
        { id: 'invite_1', email: 'staff@example.com', role: 'STAFF', tokenHash: 'hash_of_token' },
      ])
      mocks.bcryptCompare.mockResolvedValueOnce(true)
      mocks.prisma.userInvite.delete.mockResolvedValue({ id: 'invite_1' })
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'new_user_1',
        email: 'staff@example.com',
        firstName: null,
        lastName: null,
        role: 'STAFF',
      })

      const result = await acceptTeamInvite({
        rawToken: 'raw_token_value',
        password: 'newpassword123',
      })

      expect(mocks.prisma.userInvite.delete).toHaveBeenCalledWith({ where: { id: 'invite_1' } })
      expect(result.email).toBe('staff@example.com')
      expect(result.role).toBe('STAFF')
    })

    it('rejects invalid or expired invite token', async () => {
      mocks.prisma.userInvite.findMany.mockResolvedValue([
        { id: 'invite_1', email: 'staff@example.com', role: 'STAFF', tokenHash: 'hash_of_different_token' },
      ])
      mocks.bcryptCompare.mockResolvedValue(false)

      await expect(
        acceptTeamInvite({ rawToken: 'wrong_token', password: 'newpassword123' })
      ).rejects.toThrow('Invalid or expired invite link')
    })
  })

  // ── updateTeamUserRole ──────────────────────────────────────────────────────

  describe('updateTeamUserRole', () => {
    it('updates user role', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user_1', role: 'STAFF', isActive: true })
      mocks.prisma.user.update.mockResolvedValue({ id: 'user_1', email: 'u@e.com', firstName: null, lastName: null, role: 'ADMIN', isActive: true })

      const result = await updateTeamUserRole('user_1', 'ADMIN')
      expect(result.role).toBe('ADMIN')
    })

    it('prevents demoting the last active owner', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'owner_1', role: 'OWNER', isActive: true })
      mocks.prisma.user.count.mockResolvedValue(0) // 0 other active owners

      await expect(updateTeamUserRole('owner_1', 'ADMIN')).rejects.toThrow(
        'Cannot demote this user from OWNER: this is the only active OWNER account'
      )
    })

    it('allows demoting an owner when another owner exists', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'owner_1', role: 'OWNER', isActive: true })
      mocks.prisma.user.count.mockResolvedValue(1) // 1 other active owner
      mocks.prisma.user.update.mockResolvedValue({ id: 'owner_1', email: 'o@e.com', firstName: null, lastName: null, role: 'ADMIN', isActive: true })

      const result = await updateTeamUserRole('owner_1', 'ADMIN')
      expect(result.role).toBe('ADMIN')
    })
  })

  describe('updateTeamUserProfile', () => {
    it('updates first and last name for a team member', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'staff@example.com',
        firstName: null,
        lastName: null,
        role: 'STAFF',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      })
      mocks.prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'staff@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'STAFF',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      })

      const result = await updateTeamUserProfile('u1', { firstName: 'Ada', lastName: 'Lovelace' })
      expect(result.firstName).toBe('Ada')
      expect(result.lastName).toBe('Lovelace')
    })

    it('normalizes empty names to null', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'staff@example.com',
        firstName: 'Old',
        lastName: 'Name',
        role: 'STAFF',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      })
      mocks.prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'staff@example.com',
        firstName: null,
        lastName: null,
        role: 'STAFF',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      })

      await updateTeamUserProfile('u1', { firstName: '   ', lastName: '' })

      expect(mocks.prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: null,
            lastName: null,
          }),
        })
      )
    })
  })

  // ── disableTeamUser ─────────────────────────────────────────────────────────

  describe('disableTeamUser', () => {
    it('disables a user and deletes their sessions immediately', async () => {
      mocks.prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'staff_1', role: 'STAFF', isActive: true }) // for assertNotLastOwner check
        .mockResolvedValueOnce({ id: 'staff_1' }) // for the user exists check
      mocks.prisma.user.count.mockResolvedValue(1) // not last owner
      mocks.prisma.user.update.mockResolvedValue({ id: 'staff_1', email: 's@e.com', role: 'STAFF', isActive: false })

      const result = await disableTeamUser('staff_1')

      expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'staff_1' } })
      expect(result.isActive).toBe(false)
    })

    it('prevents disabling the last active owner', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'owner_1', role: 'OWNER', isActive: true })
      mocks.prisma.user.count.mockResolvedValue(0) // 0 other active owners

      await expect(disableTeamUser('owner_1')).rejects.toThrow(
        'Cannot disable this user: this is the only active OWNER account'
      )

      expect(mocks.prisma.session.deleteMany).not.toHaveBeenCalled()
    })
  })

  // ── reactivateTeamUser ──────────────────────────────────────────────────────

  describe('reactivateTeamUser', () => {
    it('reactivates a disabled user', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user_1' })
      mocks.prisma.user.update.mockResolvedValue({ id: 'user_1', email: 'u@e.com', role: 'STAFF', isActive: true })

      const result = await reactivateTeamUser('user_1')
      expect(result.isActive).toBe(true)
    })
  })

  describe('deleteDisabledTeamUser', () => {
    it('deletes a disabled user and cleans up auth artifacts', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'disabled@example.com',
        role: 'STAFF',
        isActive: false,
      })
      mocks.prisma.session.deleteMany.mockResolvedValue({ count: 2 })
      mocks.prisma.passwordReset.deleteMany.mockResolvedValue({ count: 1 })
      mocks.prisma.mfaLoginChallenge.deleteMany.mockResolvedValue({ count: 3 })
      mocks.prisma.user.delete.mockResolvedValue({ id: 'u1' })

      const result = await deleteDisabledTeamUser('u1', {
        id: 'owner_1',
        email: 'owner@example.com',
        role: 'OWNER',
      })

      expect(mocks.prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
      expect(result.deleted).toBe(true)
      expect(result.cleanup).toEqual({
        sessionsDeleted: 2,
        passwordResetsDeleted: 1,
        mfaChallengesDeleted: 3,
      })
    })

    it('prevents deleting an active user', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'active@example.com',
        role: 'STAFF',
        isActive: true,
      })

      await expect(
        deleteDisabledTeamUser('u1', { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' })
      ).rejects.toThrow('Only disabled users can be deleted')
    })

    it('prevents deleting your own account', async () => {
      await expect(
        deleteDisabledTeamUser('owner_1', { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' })
      ).rejects.toThrow('cannot delete your own account')
    })

    it('prevents deleting the only owner account', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: 'owner_2',
        email: 'owner2@example.com',
        role: 'OWNER',
        isActive: false,
      })
      mocks.prisma.user.count.mockResolvedValue(0)

      await expect(
        deleteDisabledTeamUser('owner_2', { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' })
      ).rejects.toThrow('only OWNER account')
    })
  })

  // ── revokeTeamInvite ────────────────────────────────────────────────────────

  describe('revokeTeamInvite', () => {
    it('deletes the invite', async () => {
      mocks.prisma.userInvite.findUnique.mockResolvedValue({ id: 'invite_1' })
      mocks.prisma.userInvite.delete.mockResolvedValue({ id: 'invite_1' })

      await revokeTeamInvite('invite_1')
      expect(mocks.prisma.userInvite.delete).toHaveBeenCalledWith({ where: { id: 'invite_1' } })
    })

    it('throws when invite not found', async () => {
      mocks.prisma.userInvite.findUnique.mockResolvedValue(null)
      await expect(revokeTeamInvite('missing_invite')).rejects.toThrow('Invite not found')
    })
  })

  // ── resendTeamInvite ────────────────────────────────────────────────────────

  describe('resendTeamInvite', () => {
    it('generates a new token and resets expiry', async () => {
      mocks.prisma.userInvite.findUnique.mockResolvedValue({
        id: 'invite_1',
        email: 'staff@example.com',
        role: 'STAFF',
        invitedById: 'owner_1',
      })
      mocks.prisma.userInvite.update.mockResolvedValue({
        id: 'invite_1',
        email: 'staff@example.com',
        role: 'STAFF',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        invitedById: 'owner_1',
      })

      const { rawToken, invite } = await resendTeamInvite('invite_1')

      expect(rawToken).toBeTruthy()
      expect(rawToken.length).toBeGreaterThan(32)
      const updateCall = mocks.prisma.userInvite.update.mock.calls[0][0]
      expect(updateCall.data.tokenHash).toBe('hashed_value')
      expect(invite.email).toBe('staff@example.com')
    })
  })

  // ── listTeamUsers ───────────────────────────────────────────────────────────

  describe('listTeamUsers', () => {
    it('returns all users', async () => {
      mocks.prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'owner@e.com', firstName: 'A', lastName: null, role: 'OWNER', isActive: true, lastLoginAt: null, createdAt: new Date() },
      ])
      const users = await listTeamUsers()
      expect(users).toHaveLength(1)
      expect(users[0].role).toBe('OWNER')
    })
  })

  // ── listPendingInvites ──────────────────────────────────────────────────────

  describe('listPendingInvites', () => {
    it('returns only non-expired invites', async () => {
      mocks.prisma.userInvite.findMany.mockResolvedValue([
        { id: 'i1', email: 'pending@e.com', role: 'STAFF', expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), invitedById: null },
      ])
      const invites = await listPendingInvites()
      expect(invites).toHaveLength(1)
      expect(invites[0].email).toBe('pending@e.com')
    })
  })

  // ── Production SETUP_TOKEN enforcement ─────────────────────────────────────

  describe('bootstrapOwner — production setup token enforcement', () => {
    it('requires SETUP_TOKEN in production when env var is not configured', async () => {
      mocks.env.NODE_ENV = 'production'
      mocks.env.SETUP_TOKEN = undefined
      mocks.prisma.user.findFirst.mockResolvedValue(null)

      await expect(
        bootstrapOwner({ email: 'owner@example.com', password: 'securepassword1' })
      ).rejects.toThrow('SETUP_TOKEN is required in production')
    })

    it('rejects invalid SETUP_TOKEN in production', async () => {
      mocks.env.NODE_ENV = 'production'
      mocks.env.SETUP_TOKEN = 'correct-token'
      mocks.prisma.user.findFirst.mockResolvedValue(null)

      await expect(
        bootstrapOwner({ email: 'owner@example.com', password: 'securepassword1', setupToken: 'wrong' })
      ).rejects.toThrow('Invalid setup token')
    })

    it('accepts valid SETUP_TOKEN in production', async () => {
      mocks.env.NODE_ENV = 'production'
      mocks.env.SETUP_TOKEN = 'correct-token'
      mocks.prisma.user.findFirst.mockResolvedValue(null)
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'u_prod',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
        role: 'OWNER',
      })

      const result = await bootstrapOwner({
        email: 'owner@example.com',
        password: 'securepassword1',
        setupToken: 'correct-token',
      })
      expect(result.role).toBe('OWNER')
    })

    it('does not require SETUP_TOKEN in development', async () => {
      mocks.env.NODE_ENV = 'development'
      mocks.env.SETUP_TOKEN = undefined
      mocks.prisma.user.findFirst.mockResolvedValue(null)
      mocks.prisma.user.findUnique.mockResolvedValue(null)
      mocks.prisma.user.create.mockResolvedValue({
        id: 'u_dev',
        email: 'dev@example.com',
        firstName: null,
        lastName: null,
        role: 'OWNER',
      })

      await expect(
        bootstrapOwner({ email: 'dev@example.com', password: 'devpassword1' })
      ).resolves.toMatchObject({ role: 'OWNER' })
    })
  })

  // ── requestPasswordReset ────────────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('generates a hashed reset token and stores it', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'staff@e.com', isActive: true })
      mocks.prisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 })
      mocks.prisma.passwordReset.create.mockResolvedValue({
        id: 'pr1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      })

      const { rawToken, reset } = await requestPasswordReset('u1')

      expect(rawToken).toBeTruthy()
      expect(rawToken.length).toBeGreaterThan(32)
      expect(mocks.bcryptHash).toHaveBeenCalledWith(rawToken, 10)
      const createCall = mocks.prisma.passwordReset.create.mock.calls[0][0]
      expect(createCall.data.tokenHash).toBe('hashed_value')
      expect(createCall.data).not.toHaveProperty('rawToken')
      expect(reset.userId).toBe('u1')
    })

    it('throws for disabled user', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'staff@e.com', isActive: false })

      await expect(requestPasswordReset('u1')).rejects.toThrow('disabled')
    })

    it('throws for missing user', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null)

      await expect(requestPasswordReset('nonexistent')).rejects.toThrow('User not found')
    })
  })

  // ── acceptPasswordReset ─────────────────────────────────────────────────────

  describe('acceptPasswordReset', () => {
    it('accepts valid token, updates password hash, and deletes the reset record', async () => {
      mocks.prisma.passwordReset.findMany.mockResolvedValue([
        { id: 'pr1', userId: 'u1', tokenHash: 'hashed_raw_token' },
      ])
      mocks.bcryptCompare.mockResolvedValueOnce(true)
      mocks.prisma.passwordReset.delete.mockResolvedValue({ id: 'pr1' })
      mocks.prisma.user.update.mockResolvedValue({ id: 'u1' })
      mocks.prisma.session.deleteMany.mockResolvedValue({ count: 2 })

      await acceptPasswordReset('raw_token', 'newpassword123')

      expect(mocks.bcryptHash).toHaveBeenCalledWith('newpassword123', 12)
      expect(mocks.prisma.passwordReset.delete).toHaveBeenCalledWith({ where: { id: 'pr1' } })
      expect(mocks.prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: 'hashed_value' } })
      )
      // All sessions revoked after reset
      expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    })

    it('rejects invalid or expired token', async () => {
      mocks.prisma.passwordReset.findMany.mockResolvedValue([
        { id: 'pr1', userId: 'u1', tokenHash: 'some_hash' },
      ])
      mocks.bcryptCompare.mockResolvedValue(false)

      await expect(acceptPasswordReset('bad_token', 'newpassword123')).rejects.toThrow('Invalid or expired')
    })

    it('is single-use — deletes reset record on acceptance', async () => {
      mocks.prisma.passwordReset.findMany.mockResolvedValue([
        { id: 'pr1', userId: 'u1', tokenHash: 'hash' },
      ])
      mocks.bcryptCompare.mockResolvedValueOnce(true)
      mocks.prisma.passwordReset.delete.mockResolvedValue({ id: 'pr1' })
      mocks.prisma.user.update.mockResolvedValue({ id: 'u1' })
      mocks.prisma.session.deleteMany.mockResolvedValue({ count: 0 })

      await acceptPasswordReset('raw', 'newpassword123')
      expect(mocks.prisma.passwordReset.delete).toHaveBeenCalledTimes(1)
    })
  })

  // ── getUserSessions / revokeUserSessions ────────────────────────────────────

  describe('getUserSessions', () => {
    it('returns active sessions for a user', async () => {
      mocks.prisma.session.findMany.mockResolvedValue([
        { id: 's1', ip: '1.2.3.4', userAgent: 'Chrome', createdAt: new Date(), expiresAt: new Date() },
      ])
      const sessions = await getUserSessions('u1')
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('s1')
    })
  })

  describe('revokeUserSessions', () => {
    it('deletes all sessions for user and returns count', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@e.com' })
      mocks.prisma.session.deleteMany.mockResolvedValue({ count: 3 })

      const result = await revokeUserSessions('u1')
      expect(result.count).toBe(3)
      expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    })
  })
})
