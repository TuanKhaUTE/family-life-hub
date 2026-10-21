import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  AuthSessionDataError,
  SupabaseAuthSessionRepository,
} from '../src/repositories/auth-session.repository.js'

interface SupabaseResult {
  data: unknown
  error: unknown
}

interface QueryOperation {
  method: 'select' | 'eq' | 'gt' | 'maybeSingle' | 'insert' | 'delete'
  arguments: unknown[]
}

class FakeQueryBuilder {
  readonly operations: QueryOperation[] = []

  constructor(private readonly result: SupabaseResult) {}

  select(columns: string): this {
    this.operations.push({ method: 'select', arguments: [columns] })
    return this
  }

  eq(column: string, value: unknown): this {
    this.operations.push({ method: 'eq', arguments: [column, value] })
    return this
  }

  gt(column: string, value: unknown): this {
    this.operations.push({ method: 'gt', arguments: [column, value] })
    return this
  }

  async maybeSingle(): Promise<SupabaseResult> {
    this.operations.push({ method: 'maybeSingle', arguments: [] })
    return this.result
  }

  async insert(values: Record<string, unknown>): Promise<SupabaseResult> {
    this.operations.push({ method: 'insert', arguments: [values] })
    return this.result
  }

  delete(): {
    eq: (column: string, value: unknown) => Promise<SupabaseResult>
  } {
    this.operations.push({ method: 'delete', arguments: [] })
    return {
      eq: async (column: string, value: unknown) => {
        this.operations.push({ method: 'eq', arguments: [column, value] })
        return this.result
      },
    }
  }
}

class FakeSupabaseClient {
  readonly queries: Array<{ table: string; builder: FakeQueryBuilder }> = []
  result: SupabaseResult = { data: null, error: null }

  from(table: string): FakeQueryBuilder {
    const builder = new FakeQueryBuilder(this.result)
    this.queries.push({ table, builder })
    return builder
  }
}

const memberId = '11111111-1111-4111-8111-111111111111'
const sessionId = '22222222-2222-4222-8222-222222222222'
const tokenHash = 'a'.repeat(64)
const now = new Date('2026-10-21T00:00:00.000Z')
const expiresAt = new Date('2026-10-28T00:00:00.000Z')
const safeProfileRow = {
  id: memberId,
  display_name: 'Synthetic Member',
  role: 'MEMBER',
  avatar_type: null,
  avatar_value: null,
  is_active: true,
}

function createHarness(client = new FakeSupabaseClient()) {
  const repository = new SupabaseAuthSessionRepository(
    () => client as unknown as SupabaseClient,
  )

  return { client, repository }
}

describe('SupabaseAuthSessionRepository.createSession', () => {
  it('inserts only the member, token hash, and fixed expiry', async () => {
    const { client, repository } = createHarness()

    await expect(
      repository.createSession({ memberId, tokenHash, expiresAt }),
    ).resolves.toBeUndefined()
    expect(client.queries[0]).toEqual({
      table: 'auth_sessions',
      builder: expect.any(FakeQueryBuilder),
    })
    expect(client.queries[0]!.builder.operations).toEqual([
      {
        method: 'insert',
        arguments: [
          {
            member_id: memberId,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
          },
        ],
      },
    ])
  })
})

describe('SupabaseAuthSessionRepository.findAuthenticatedSession', () => {
  it('returns only a session ID and safe active profile for a future expiry', async () => {
    const { client, repository } = createHarness()
    client.result = {
      data: {
        id: sessionId,
        expires_at: expiresAt.toISOString(),
        family_members: safeProfileRow,
      },
      error: null,
    }

    await expect(
      repository.findAuthenticatedSession(tokenHash, now),
    ).resolves.toEqual({
      sessionId,
      profile: {
        id: memberId,
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType: null,
        avatarValue: null,
      },
    })
    expect(client.queries[0]!.builder.operations).toEqual([
      {
        method: 'select',
        arguments: [
          'id, expires_at, family_members!inner(id, display_name, role, avatar_type, avatar_value, is_active)',
        ],
      },
      { method: 'eq', arguments: ['token_hash', tokenHash] },
      { method: 'gt', arguments: ['expires_at', now.toISOString()] },
      { method: 'eq', arguments: ['family_members.is_active', true] },
      { method: 'maybeSingle', arguments: [] },
    ])
  })

  it('returns null for an unknown, expired, or inactive session', async () => {
    const { repository } = createHarness()

    await expect(
      repository.findAuthenticatedSession(tokenHash, now),
    ).resolves.toBeNull()
  })
})

describe('SupabaseAuthSessionRepository.deleteByTokenHash', () => {
  it('deletes only the row matching the current token hash', async () => {
    const { client, repository } = createHarness()

    await expect(repository.deleteByTokenHash(tokenHash)).resolves.toBeUndefined()
    expect(client.queries[0]!.builder.operations).toEqual([
      { method: 'delete', arguments: [] },
      { method: 'eq', arguments: ['token_hash', tokenHash] },
    ])
  })
})

describe('SupabaseAuthSessionRepository safe failures', () => {
  it.each(['create', 'find', 'delete'] as const)(
    'redacts upstream %s errors',
    async (operation) => {
      const client = new FakeSupabaseClient()
      client.result = { data: null, error: { message: 'secret database detail' } }
      const { repository } = createHarness(client)

      const result =
        operation === 'create'
          ? repository.createSession({ memberId, tokenHash, expiresAt })
          : operation === 'find'
            ? repository.findAuthenticatedSession(tokenHash, now)
            : repository.deleteByTokenHash(tokenHash)

      await expect(result).rejects.toBeInstanceOf(AuthSessionDataError)
      await expect(result).rejects.not.toThrow('secret database detail')
    },
  )
})
