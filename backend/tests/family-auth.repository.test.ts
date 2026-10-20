import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  FamilyAuthDataError,
  SupabaseFamilyAuthRepository,
} from '../src/repositories/family-auth.repository.js'

interface SupabaseResult {
  data: unknown
  error: unknown
}

interface QueryOperation {
  method: 'select' | 'eq' | 'order' | 'maybeSingle'
  arguments: unknown[]
}

class FakeQueryBuilder {
  readonly operations: QueryOperation[] = []
  private orderCallCount = 0

  constructor(private readonly result: SupabaseResult) {}

  select(columns: string): this {
    this.operations.push({ method: 'select', arguments: [columns] })
    return this
  }

  eq(column: string, value: unknown): this {
    this.operations.push({ method: 'eq', arguments: [column, value] })
    return this
  }

  order(
    column: string,
    options: { ascending: boolean },
  ): this | Promise<SupabaseResult> {
    this.operations.push({ method: 'order', arguments: [column, options] })
    this.orderCallCount += 1

    return this.orderCallCount === 2 ? Promise.resolve(this.result) : this
  }

  async maybeSingle(): Promise<SupabaseResult> {
    this.operations.push({ method: 'maybeSingle', arguments: [] })
    return this.result
  }

}

class FakeSupabaseClient {
  readonly queries: Array<{ table: string; builder: FakeQueryBuilder }> = []
  readonly rpcCalls: Array<{
    name: string
    arguments: Record<string, unknown>
  }> = []
  queryResults = new Map<string, SupabaseResult>()
  rpcResults = new Map<string, SupabaseResult>()

  from(table: string): FakeQueryBuilder {
    const builder = new FakeQueryBuilder(
      this.queryResults.get(table) ?? { data: [], error: null },
    )
    this.queries.push({ table, builder })
    return builder
  }

  async rpc(
    name: string,
    arguments_: Record<string, unknown>,
  ): Promise<SupabaseResult> {
    this.rpcCalls.push({ name, arguments: arguments_ })
    return this.rpcResults.get(name) ?? { data: false, error: null }
  }
}

const memberId = '11111111-1111-4111-8111-111111111111'
const syntheticHash = '$argon2id$synthetic-test-hash-value'
const safeProfileRow = {
  id: memberId,
  display_name: 'Synthetic Member',
  role: 'MEMBER',
  avatar_type: null,
  avatar_value: null,
  is_active: true,
}

function createHarness(client = new FakeSupabaseClient()) {
  let clientFactoryCalls = 0
  const repository = new SupabaseFamilyAuthRepository(() => {
    clientFactoryCalls += 1
    return client as unknown as SupabaseClient
  })

  return {
    client,
    repository,
    get clientFactoryCalls() {
      return clientFactoryCalls
    },
  }
}

describe('SupabaseFamilyAuthRepository.listActiveProfiles', () => {
  it('maps only the safe active profile projection in stable order', async () => {
    const harness = createHarness()
    harness.client.queryResults.set('family_members', {
      data: [safeProfileRow],
      error: null,
    })

    await expect(harness.repository.listActiveProfiles()).resolves.toEqual([
      {
        id: memberId,
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType: null,
        avatarValue: null,
      },
    ])
    expect(harness.clientFactoryCalls).toBe(1)
    expect(harness.client.queries[0]).toEqual({
      table: 'family_members',
      builder: expect.any(FakeQueryBuilder),
    })
    expect(harness.client.queries[0]!.builder.operations).toEqual([
      {
        method: 'select',
        arguments: [
          'id, display_name, role, avatar_type, avatar_value, is_active',
        ],
      },
      { method: 'eq', arguments: ['is_active', true] },
      { method: 'order', arguments: ['display_name', { ascending: true }] },
      { method: 'order', arguments: ['id', { ascending: true }] },
    ])
  })

  it('rejects inactive or malformed rows instead of leaking unexpected data', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('family_members', {
      data: [{ ...safeProfileRow, is_active: false, pin_hash: syntheticHash }],
      error: null,
    })

    await expect(repository.listActiveProfiles()).rejects.toBeInstanceOf(
      FamilyAuthDataError,
    )
  })

  it('redacts upstream profile-query failures', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('family_members', {
      data: null,
      error: { message: 'upstream secret detail' },
    })

    const result = repository.listActiveProfiles()

    await expect(result).rejects.toBeInstanceOf(FamilyAuthDataError)
    await expect(result).rejects.not.toThrow('upstream secret detail')
  })
})

describe('SupabaseFamilyAuthRepository.findActiveLoginRecord', () => {
  it('maps the private credential row without adding it to the safe profile', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('auth_credentials', {
      data: {
        pin_hash: syntheticHash,
        failed_attempt_count: 2,
        locked_until: '2026-10-21T00:15:00.000Z',
        family_members: safeProfileRow,
      },
      error: null,
    })

    await expect(repository.findActiveLoginRecord(memberId)).resolves.toEqual({
      profile: {
        id: memberId,
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType: null,
        avatarValue: null,
      },
      pinHash: syntheticHash,
      failedAttemptCount: 2,
      lockedUntil: new Date('2026-10-21T00:15:00.000Z'),
    })
    expect(client.queries[0]!.table).toBe('auth_credentials')
    expect(client.queries[0]!.builder.operations).toEqual([
      {
        method: 'select',
        arguments: [
          'pin_hash, failed_attempt_count, locked_until, family_members!inner(id, display_name, role, avatar_type, avatar_value, is_active)',
        ],
      },
      { method: 'eq', arguments: ['member_id', memberId] },
      { method: 'eq', arguments: ['family_members.is_active', true] },
      { method: 'maybeSingle', arguments: [] },
    ])
  })

  it('returns null when no active member credential exists', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('auth_credentials', { data: null, error: null })

    await expect(repository.findActiveLoginRecord(memberId)).resolves.toBeNull()
  })

  it('rejects malformed or failed credential queries with a redacted error', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('auth_credentials', {
      data: {
        pin_hash: 'bad',
        failed_attempt_count: -1,
        locked_until: 'not-a-date',
        family_members: { ...safeProfileRow, role: 'OWNER' },
      },
      error: { message: 'upstream secret detail' },
    })

    const result = repository.findActiveLoginRecord(memberId)

    await expect(result).rejects.toBeInstanceOf(FamilyAuthDataError)
    await expect(result).rejects.not.toThrow('upstream secret detail')
  })
})

describe('SupabaseFamilyAuthRepository lockout mutations', () => {
  it('records a failed login through the restricted RPC', async () => {
    const { client, repository } = createHarness()
    client.rpcResults.set('record_failed_pin_login', {
      data: true,
      error: null,
    })

    await expect(repository.recordFailedLogin(memberId)).resolves.toBeUndefined()
    expect(client.rpcCalls).toEqual([
      {
        name: 'record_failed_pin_login',
        arguments: { p_member_id: memberId },
      },
    ])
  })

  it('returns the successful-login RPC decision', async () => {
    const { client, repository } = createHarness()
    client.rpcResults.set('complete_successful_pin_login', {
      data: false,
      error: null,
    })

    await expect(repository.completeSuccessfulLogin(memberId)).resolves.toBe(
      false,
    )
    expect(client.rpcCalls).toEqual([
      {
        name: 'complete_successful_pin_login',
        arguments: { p_member_id: memberId },
      },
    ])
  })

  it.each(['record_failed_pin_login', 'complete_successful_pin_login'])(
    'redacts malformed or failed %s responses',
    async (rpcName) => {
      const { client, repository } = createHarness()
      client.rpcResults.set(rpcName, {
        data: 'unexpected',
        error: { message: 'upstream secret detail' },
      })

      const result =
        rpcName === 'record_failed_pin_login'
          ? repository.recordFailedLogin(memberId)
          : repository.completeSuccessfulLogin(memberId)

      await expect(result).rejects.toBeInstanceOf(FamilyAuthDataError)
      await expect(result).rejects.not.toThrow('upstream secret detail')
    },
  )
})
