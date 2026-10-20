import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  FamilyMemberBootstrapDataError,
  SupabaseFamilyMemberBootstrapRepository,
} from '../src/repositories/family-member-bootstrap.repository.js'

interface SupabaseResult {
  data: unknown
  error: unknown
}

class FakeSupabaseClient {
  selectedTable?: string
  selectedColumns?: string
  rpcName?: string
  rpcArguments?: Record<string, unknown>
  selectResult: SupabaseResult = { data: [], error: null }
  rpcResult: SupabaseResult = {
    data: '11111111-1111-4111-8111-111111111111',
    error: null,
  }

  from(table: string) {
    this.selectedTable = table

    return {
      select: async (columns: string) => {
        this.selectedColumns = columns
        return this.selectResult
      },
    }
  }

  async rpc(name: string, arguments_: Record<string, unknown>) {
    this.rpcName = name
    this.rpcArguments = arguments_
    return this.rpcResult
  }
}

function createRepository(client = new FakeSupabaseClient()) {
  return {
    client,
    repository: new SupabaseFamilyMemberBootstrapRepository(
      client as unknown as SupabaseClient,
    ),
  }
}

describe('SupabaseFamilyMemberBootstrapRepository.listMemberSummaries', () => {
  it('maps the selected database fields to service summaries', async () => {
    const { client, repository } = createRepository()
    client.selectResult = {
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          display_name: 'Synthetic Member',
          role: 'MEMBER',
          is_active: true,
        },
      ],
      error: null,
    }

    await expect(repository.listMemberSummaries()).resolves.toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        isActive: true,
      },
    ])
    expect(client.selectedTable).toBe('family_members')
    expect(client.selectedColumns).toBe('id, display_name, role, is_active')
  })

  it('returns a redacted error when the member query fails', async () => {
    const { client, repository } = createRepository()
    client.selectResult = {
      data: null,
      error: { message: 'upstream secret detail' },
    }

    const result = repository.listMemberSummaries()

    await expect(result).rejects.toBeInstanceOf(FamilyMemberBootstrapDataError)
    await expect(result).rejects.not.toThrow('upstream secret detail')
  })

  it('rejects malformed member data', async () => {
    const { client, repository } = createRepository()
    client.selectResult = {
      data: [{ id: 42, display_name: null, role: 'OWNER', is_active: 'yes' }],
      error: null,
    }

    await expect(repository.listMemberSummaries()).rejects.toBeInstanceOf(
      FamilyMemberBootstrapDataError,
    )
  })
})

describe('SupabaseFamilyMemberBootstrapRepository.createWithCredential', () => {
  it('calls the atomic RPC with profile fields and only the generated hash', async () => {
    const { client, repository } = createRepository()
    const pinHash = '$argon2id$synthetic-test-hash-value'

    await expect(
      repository.createWithCredential({
        displayName: 'Synthetic Member',
        role: 'ADMIN',
        avatarType: null,
        avatarValue: null,
        pinHash,
      }),
    ).resolves.toBe('11111111-1111-4111-8111-111111111111')
    expect(client.rpcName).toBe('bootstrap_family_member')
    expect(client.rpcArguments).toEqual({
      p_display_name: 'Synthetic Member',
      p_role: 'ADMIN',
      p_avatar_type: null,
      p_avatar_value: null,
      p_pin_hash: pinHash,
    })
    expect(client.rpcArguments).not.toHaveProperty('pin')
  })

  it('returns a redacted error when the RPC fails', async () => {
    const { client, repository } = createRepository()
    client.rpcResult = {
      data: null,
      error: { message: 'upstream secret detail' },
    }

    const result = repository.createWithCredential({
      displayName: 'Synthetic Member',
      role: 'MEMBER',
      avatarType: 'PRESET',
      avatarValue: 'avatar-one',
      pinHash: '$argon2id$synthetic-test-hash-value',
    })

    await expect(result).rejects.toBeInstanceOf(FamilyMemberBootstrapDataError)
    await expect(result).rejects.not.toThrow('upstream secret detail')
  })

  it('rejects a malformed RPC result', async () => {
    const { client, repository } = createRepository()
    client.rpcResult = { data: null, error: null }

    await expect(
      repository.createWithCredential({
        displayName: 'Synthetic Member',
        role: 'PARENT',
        avatarType: null,
        avatarValue: null,
        pinHash: '$argon2id$synthetic-test-hash-value',
      }),
    ).rejects.toBeInstanceOf(FamilyMemberBootstrapDataError)
  })
})
