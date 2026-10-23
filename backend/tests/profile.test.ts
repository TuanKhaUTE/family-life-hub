import request from 'supertest'
import express from 'express'
import { expect, it, vi } from 'vitest'
import app from '../src/app.js'
import {
  ProfileService,
  type ProfileRepository,
} from '../src/services/profile.service.js'
import { createProfileRouter } from '../src/routes/profile.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import type {
  FamilyAuthRepository,
  SafeFamilyProfile,
} from '../src/services/family-auth.service.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import { hashPin, verifyPin } from '../src/security/pin.js'
import { FamilyAuthService } from '../src/services/family-auth.service.js'
import { SupabaseAuthSessionRepository } from '../src/repositories/auth-session.repository.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProfileRepository } from '../src/repositories/profile.repository.js'
it('profile repository whitelists safe updates and binds rotation to authenticated actor/session', async () => {
  const s = setup('ADMIN'),
    rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...s.profile, pin_hash: 'must-not-leak' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null }),
    r = new SupabaseProfileRepository(
      () => ({ rpc }) as unknown as SupabaseClient,
    )
  expect(
    await r.update(s.auth, { ...input, displayName: 'Synthetic Updated' }),
  ).toEqual(s.profile)
  await r.rotate(s.auth, other, syntheticHash, 'synthetic-new-hash', true)
  expect(rpc).toHaveBeenCalledWith('rotate_family_pin', {
    p_actor_member_id: id,
    p_session_id: sessionId,
    p_target_member_id: other,
    p_expected_pin_hash: syntheticHash,
    p_new_pin_hash: 'synthetic-new-hash',
    p_reset: true,
  })
})
it('profile repository uses a deterministic owner path and service-mediated profile update', async () => {
  const s = setup(),
    rpc = vi.fn(async () => ({
      data: {
        ...s.profile,
        avatarType: 'IMAGE',
        avatarValue: '/api/profile/avatar/' + id + '?v=42',
      },
      error: null,
    })),
    upload = vi.fn(async () => ({ data: { path: 'ignored' }, error: null })),
    remove = vi.fn(async () => ({ data: [], error: null })),
    getPublicUrl = vi.fn(() => ({
      data: { publicUrl: 'https://synthetic.example/avatar.webp' },
    })),
    storage = {
      from: vi.fn(() => ({ upload, remove, getPublicUrl })),
    },
    r = new SupabaseProfileRepository(
      () => ({ rpc, storage }) as unknown as SupabaseClient,
    )

  expect(await r.uploadAvatar(s.auth, webpBytes(), '42')).toMatchObject({
    avatarType: 'IMAGE',
    avatarValue: '/api/profile/avatar/' + id + '?v=42',
  })
  expect(upload).toHaveBeenCalledWith(
    'avatars/' + id + '/avatar.webp',
    expect.anything(),
    { contentType: 'image/webp', cacheControl: '31536000', upsert: true },
  )
  expect(rpc).toHaveBeenCalledWith('update_own_family_profile', {
    p_actor_member_id: id,
    p_session_id: sessionId,
    p_input: {
      displayName: s.profile.displayName,
      avatarType: 'IMAGE',
      avatarValue: '/api/profile/avatar/' + id + '?v=42',
    },
  })
  expect(r.publicAvatarUrl(id)).toBe('https://synthetic.example/avatar.webp')
})
it.each([
  ['42501', 403],
  ['28000', 401],
  ['P0002', 404],
  ['22023', 400],
  ['XX000', 503],
] as const)('repository redacts %s failures', async (code, status) => {
  const s = setup(),
    rpc = vi.fn(async () => ({
      data: null,
      error: { code, message: 'sensitive upstream detail' },
    })),
    r = new SupabaseProfileRepository(
      () => ({ rpc }) as unknown as SupabaseClient,
    )
  await expect(
    r.rotate(s.auth, id, syntheticHash, 'synthetic-new-hash', false),
  ).rejects.toMatchObject({ status })
  await expect(
    r.rotate(s.auth, id, syntheticHash, 'synthetic-new-hash', false),
  ).rejects.not.toThrow('sensitive')
})
it('safe API failure never echoes upstream PIN/hash/session internals', async () => {
  const s = setup()
  vi.mocked(s.repository.rotate).mockRejectedValue(
    new Error('synthetic-secret-internals'),
  )
  const r = await request(s.app)
    .post('/profile/me/pin')
    .send({
      currentPin: syntheticCurrent,
      newPin: syntheticNew,
      confirmation: syntheticNew,
    })
  expect(r.status).toBe(503)
  expect(JSON.stringify(r.body)).not.toMatch(
    /synthetic-secret|pinHash|sessionId|123456|654321/,
  )
})
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222',
  sessionId = '33333333-3333-4333-8333-333333333333'
const syntheticCurrent = '123456',
  syntheticNew = '654321',
  syntheticHash = 'synthetic-encoded-existing-hash'
const input = {
  displayName: ' Synthetic Updated ',
  avatarType: 'EMOJI',
  avatarValue: '🌿',
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const profile = {
      id,
      role,
      displayName: 'Synthetic Member',
      avatarType: null,
      avatarValue: null,
    },
    auth = { sessionId, profile }
  const repository: ProfileRepository = {
    update: vi.fn(async () => ({
      ...profile,
      ...input,
      displayName: 'Synthetic Updated',
    })),
    rotate: vi.fn(async () => {}),
    uploadAvatar: vi.fn(async () => ({
      ...profile,
      avatarType: 'IMAGE',
      avatarValue: '/api/profile/avatar/' + id + '?v=1',
    })),
    deleteAvatar: vi.fn(async () => {}),
    publicAvatarUrl: vi.fn(() =>
      'https://synthetic.example/storage/family-avatars/avatars/' + id,
    ),
  }
  const credentials: FamilyAuthRepository = {
    listActiveProfiles: vi.fn(async () => [
      profile,
      { ...profile, id: other, displayName: 'Synthetic Other' },
    ]),
    findActiveLoginRecord: vi.fn(async () => ({
      profile,
      pinHash: syntheticHash,
      failedAttemptCount: 0,
      lockedUntil: null,
    })),
    recordFailedLogin: vi.fn(async () => {}),
    completeSuccessfulLogin: vi.fn(async () => true),
  }
  const verifier = vi.fn(async () => true),
    hasher = vi.fn(async () => 'synthetic-encoded-replacement-hash')
  const service = new ProfileService(
    repository,
    credentials,
    verifier,
    hasher,
    () => new Date('2026-10-22T00:00:00Z'),
  )
  const sessions = {
    authenticate: async () => auth,
  } as unknown as FamilySessionOperations
  return {
    profile,
    auth,
    repository,
    credentials,
    verifier,
    hasher,
    service,
    app: express()
      .use(express.json())
      .use('/profile', createProfileRouter(service, sessions))
      .use(errorHandler),
  }
}
it('own profile settings require a session', async () => {
  expect((await request(app).get('/api/profile/me')).status).toBe(401)
})
it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
  '%s reads/updates own profile without an owner selector or auth internals',
  async (role) => {
    const s = setup(role),
      r = await request(s.app).get('/profile/me?memberId=' + other)
    expect(r.status).toBe(200)
    expect(r.headers['cache-control']).toBe('no-store')
    expect(r.body.settings.profile).toEqual(s.profile)
    expect(r.body.settings.avatarChoices.length).toBeGreaterThan(2)
    expect(JSON.stringify(r.body)).not.toMatch(/sessionId|pinHash|lockedUntil/)
    expect((await request(s.app).put('/profile/me').send(input)).status).toBe(
      200,
    )
    expect(s.repository.update).toHaveBeenCalledWith(s.auth, {
      ...input,
      displayName: 'Synthetic Updated',
    })
    expect(
      (
        await request(s.app)
          .put('/profile/members/' + other)
          .send(input)
      ).status,
    ).toBe(404)
  },
)
it.each([
  { ...input, memberId: other },
  { ...input, role: 'ADMIN' },
  { ...input, displayName: ' ' },
  { ...input, displayName: 'x'.repeat(101) },
  { ...input, displayName: 'Bad\nName' },
  {
    ...input,
    avatarType: 'IMAGE',
    avatarValue: 'https://invalid.example/avatar.png',
  },
  { ...input, avatarValue: 'not-a-preset' },
  { ...input, avatarType: null },
])('rejects unsafe profile input %#', async (invalid) => {
  const s = setup()
  expect((await request(s.app).put('/profile/me').send(invalid)).status).toBe(
    400,
  )
  expect(s.repository.update).not.toHaveBeenCalled()
})

it('uploads an owner-bound avatar without accepting a target member selector', async () => {
  const s = setup(),
    repository = s.repository as ProfileRepository & {
      uploadAvatar: ReturnType<typeof vi.fn>
    },
    response = await request(s.app)
      .put('/profile/me/avatar?memberId=' + other)
      .set('Content-Type', 'image/webp')
      .send(webpBytes())

  expect(response.status).toBe(200)
  expect(response.body.profile.avatarType).toBe('IMAGE')
  expect(repository.uploadAvatar).toHaveBeenCalledWith(
    s.auth,
    expect.any(Buffer),
    expect.any(String),
  )
})

it('keeps an administrator avatar upload bound to the administrator session', async () => {
  const s = setup('ADMIN'),
    repository = s.repository as ProfileRepository & {
      uploadAvatar: ReturnType<typeof vi.fn>
    },
    response = await request(s.app)
      .put('/profile/me/avatar?memberId=' + other)
      .set('Content-Type', 'image/webp')
      .send(webpBytes())

  expect(response.status).toBe(200)
  expect(response.body.profile.id).toBe(id)
  expect(repository.uploadAvatar).toHaveBeenCalledWith(
    s.auth,
    expect.any(Buffer),
    expect.any(String),
  )
})

it.each([
  ['unsupported content type', 'image/gif', Buffer.from('GIF89a')],
  ['invalid image bytes', 'image/webp', Buffer.from('not an image')],
] as const)('rejects %s before storage', async (_label, contentType, body) => {
  const s = setup(),
    repository = s.repository as ProfileRepository & {
      uploadAvatar: ReturnType<typeof vi.fn>
    },
    response = await request(s.app)
      .put('/profile/me/avatar')
      .set('Content-Type', contentType)
      .send(body)

  expect(response.status).toBe(400)
  expect(repository.uploadAvatar).not.toHaveBeenCalled()
})

it('rejects an oversized avatar before storage', async () => {
  const s = setup(),
    repository = s.repository as ProfileRepository & {
      uploadAvatar: ReturnType<typeof vi.fn>
    },
    response = await request(s.app)
      .put('/profile/me/avatar')
      .set('Content-Type', 'image/webp')
      .send(Buffer.concat([webpBytes(), Buffer.alloc(5 * 1024 * 1024)]))

  expect(response.status).toBe(413)
  expect(repository.uploadAvatar).not.toHaveBeenCalled()
})

it('removes the current owner avatar when switching to an emoji', async () => {
  const s = setup()
  s.auth.profile.avatarType = 'IMAGE'
  s.auth.profile.avatarValue = '/api/profile/avatar/' + id + '?v=1'
  const repository = s.repository as ProfileRepository & {
    deleteAvatar: ReturnType<typeof vi.fn>
  }

  expect(
    (
      await request(s.app)
        .put('/profile/me')
        .send({ ...input, avatarType: 'EMOJI', avatarValue: '🌿' })
    ).status,
  ).toBe(200)
  expect(repository.deleteAvatar).toHaveBeenCalledWith(s.auth)
})

function webpBytes() {
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ])
}
it('allows keeping an existing legacy avatar but not replacing it with another arbitrary URL', async () => {
  const s = setup()
  s.profile.avatarType = 'IMAGE' as never
  s.profile.avatarValue = '/existing-avatar.png' as never
  expect(
    (
      await request(s.app)
        .put('/profile/me')
        .send({
          ...input,
          avatarType: 'IMAGE',
          avatarValue: '/existing-avatar.png',
        })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(s.app)
        .put('/profile/me')
        .send({ ...input, avatarType: 'IMAGE', avatarValue: '/different.png' })
    ).status,
  ).toBe(400)
})
it('own PIN change verifies current PIN, hashes new PIN and atomically rotates own credential/session scope', async () => {
  const s = setup(),
    r = await request(s.app).post('/profile/me/pin').send({
      currentPin: syntheticCurrent,
      newPin: syntheticNew,
      confirmation: syntheticNew,
    })
  expect(r.status).toBe(204)
  expect(r.headers['set-cookie'][0]).toContain('family_session=;')
  expect(s.verifier).toHaveBeenCalledWith(syntheticCurrent, syntheticHash)
  expect(s.hasher).toHaveBeenCalledWith(syntheticNew)
  expect(s.repository.rotate).toHaveBeenCalledWith(
    s.auth,
    id,
    syntheticHash,
    'synthetic-encoded-replacement-hash',
    false,
  )
  expect(
    JSON.stringify(vi.mocked(s.repository.rotate).mock.calls),
  ).not.toContain(syntheticNew)
})
it('wrong current PIN counts a hash-bound failure without hashing or mutation', async () => {
  const s = setup()
  s.verifier.mockResolvedValue(false)
  expect(
    (
      await request(s.app).post('/profile/me/pin').send({
        currentPin: syntheticCurrent,
        newPin: syntheticNew,
        confirmation: syntheticNew,
      })
    ).status,
  ).toBe(401)
  expect(s.credentials.recordFailedLogin).toHaveBeenCalledWith(
    id,
    syntheticHash,
  )
  expect(s.hasher).not.toHaveBeenCalled()
  expect(s.repository.rotate).not.toHaveBeenCalled()
})
it('active lock rejects credential changes before Argon2 work', async () => {
  const s = setup()
  vi.mocked(s.credentials.findActiveLoginRecord).mockResolvedValue({
    profile: s.profile,
    pinHash: syntheticHash,
    failedAttemptCount: 5,
    lockedUntil: new Date('2026-10-22T00:15:00Z'),
  })
  expect(
    (
      await request(s.app).post('/profile/me/pin').send({
        currentPin: syntheticCurrent,
        newPin: syntheticNew,
        confirmation: syntheticNew,
      })
    ).status,
  ).toBe(401)
  expect(s.verifier).not.toHaveBeenCalled()
})
it.each(['12345', 'abcdef', '1234567', '１２３４５６'])(
  'invalid new PIN %s never reaches verification/storage',
  async (newPin) => {
    const s = setup()
    expect(
      (
        await request(s.app)
          .post('/profile/me/pin')
          .send({ currentPin: syntheticCurrent, newPin, confirmation: newPin })
      ).status,
    ).toBe(400)
    expect(s.verifier).not.toHaveBeenCalled()
  },
)
it('rejects mismatched confirmation and extra actor/hash fields', async () => {
  const s = setup()
  for (const body of [
    {
      currentPin: syntheticCurrent,
      newPin: syntheticNew,
      confirmation: syntheticCurrent,
    },
    {
      currentPin: syntheticCurrent,
      newPin: syntheticNew,
      confirmation: syntheticNew,
      memberId: other,
    },
  ])
    expect(
      (await request(s.app).post('/profile/me/pin').send(body)).status,
    ).toBe(400)
})
it('ADMIN re-verifies own PIN and explicitly confirms resetting an active other member', async () => {
  const s = setup('ADMIN'),
    members = await request(s.app).get('/profile/members')
  expect(members.status).toBe(200)
  expect(members.body.members.map((m: { id: string }) => m.id)).toEqual([other])
  const r = await request(s.app)
    .post('/profile/members/' + other + '/pin-reset')
    .send({
      currentPin: syntheticCurrent,
      newPin: syntheticNew,
      confirmation: syntheticNew,
      confirmReset: true,
    })
  expect(r.status).toBe(204)
  expect(r.headers['set-cookie']).toBeUndefined()
  expect(s.repository.rotate).toHaveBeenCalledWith(
    s.auth,
    other,
    syntheticHash,
    'synthetic-encoded-replacement-hash',
    true,
  )
  expect(
    (
      await request(s.app)
        .post('/profile/members/' + id + '/pin-reset')
        .send({
          currentPin: syntheticCurrent,
          newPin: syntheticNew,
          confirmation: syntheticNew,
          confirmReset: true,
        })
    ).status,
  ).toBe(400)
})
it.each(['MEMBER', 'PARENT'] as const)(
  '%s cannot list recovery targets or reset others',
  async (role) => {
    const s = setup(role)
    expect((await request(s.app).get('/profile/members')).status).toBe(403)
    expect(
      (
        await request(s.app)
          .post('/profile/members/' + other + '/pin-reset')
          .send({
            currentPin: syntheticCurrent,
            newPin: syntheticNew,
            confirmation: syntheticNew,
            confirmReset: true,
          })
      ).status,
    ).toBe(403)
    expect(s.credentials.findActiveLoginRecord).not.toHaveBeenCalled()
  },
)
it('reset requires confirmation and rejects missing/inactive targets before Argon2', async () => {
  const s = setup('ADMIN')
  expect(
    (
      await request(s.app)
        .post('/profile/members/' + other + '/pin-reset')
        .send({
          currentPin: syntheticCurrent,
          newPin: syntheticNew,
          confirmation: syntheticNew,
        })
    ).status,
  ).toBe(400)
  vi.mocked(s.credentials.listActiveProfiles).mockResolvedValue([s.profile])
  expect(
    (
      await request(s.app)
        .post('/profile/members/' + other + '/pin-reset')
        .send({
          currentPin: syntheticCurrent,
          newPin: syntheticNew,
          confirmation: syntheticNew,
          confirmReset: true,
        })
    ).status,
  ).toBe(404)
  expect(s.verifier).not.toHaveBeenCalled()
})
it('real existing Argon2 utility produces a verifiable replacement, not plaintext', async () => {
  const s = setup(),
    existing = await hashPin(syntheticCurrent)
  vi.mocked(s.credentials.findActiveLoginRecord).mockResolvedValue({
    profile: s.profile,
    pinHash: existing,
    failedAttemptCount: 0,
    lockedUntil: null,
  })
  const service = new ProfileService(s.repository, s.credentials)
  await service.changePin(s.auth, {
    currentPin: syntheticCurrent,
    newPin: syntheticNew,
    confirmation: syntheticNew,
  })
  const stored = vi.mocked(s.repository.rotate).mock.calls[0]![3]
  expect(stored.split('$').slice(1, 3)).toEqual(['argon2id', 'v=19'])
  expect(new Set(stored.split('$')[3]!.split(','))).toEqual(
    new Set(['m=19456', 't=2', 'p=1']),
  )
  expect(await verifyPin(syntheticNew, stored)).toBe(true)
  expect(await verifyPin(syntheticCurrent, stored)).toBe(false)
})
it('login binds credential completion and session creation to the hash actually verified', async () => {
  const s = setup(),
    createSession = vi.fn(async () => ({
      token: 'synthetic-token',
      expiresAt: new Date('2099-01-01'),
    }))
  const login = new FamilyAuthService(
    s.credentials,
    { createSession },
    s.verifier,
  )
  await login.login({ memberId: id, pin: syntheticCurrent })
  expect(s.credentials.completeSuccessfulLogin).toHaveBeenCalledWith(
    id,
    syntheticHash,
  )
  expect(createSession).toHaveBeenCalledWith(id, syntheticHash)
})
it('session repository uses atomic verified-hash RPC instead of racing a naked insert', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: null })),
    insert = vi.fn(async () => ({ data: null, error: null }))
  const repository = new SupabaseAuthSessionRepository(
    () => ({ rpc, from: () => ({ insert }) }) as unknown as SupabaseClient,
  )
  const expiresAt = new Date('2099-01-01')
  await repository.createSession({
    memberId: id,
    tokenHash: 'a'.repeat(64),
    expiresAt,
    verifiedPinHash: syntheticHash,
  })
  expect(rpc).toHaveBeenCalledWith('create_verified_auth_session', {
    p_member_id: id,
    p_expected_pin_hash: syntheticHash,
    p_token_hash: 'a'.repeat(64),
    p_expires_at: expiresAt.toISOString(),
  })
  expect(insert).not.toHaveBeenCalled()
})
