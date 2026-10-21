import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  BreakfastDataError,
  SupabaseBreakfastRepository,
} from '../src/repositories/breakfast.repository.js'

interface SupabaseResult {
  data: unknown
  error: unknown
}

interface QueryOperation {
  method: 'select' | 'eq' | 'in' | 'order' | 'maybeSingle' | 'upsert' | 'single'
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

  in(column: string, values: string[]): this {
    this.operations.push({ method: 'in', arguments: [column, values] })
    return this
  }

  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<SupabaseResult> {
    this.operations.push({ method: 'order', arguments: [column, options] })
    return Promise.resolve(this.result)
  }

  maybeSingle(): Promise<SupabaseResult> {
    this.operations.push({ method: 'maybeSingle', arguments: [] })
    return Promise.resolve(this.result)
  }

  upsert(
    value: Record<string, unknown>,
    options: { onConflict: string },
  ): this {
    this.operations.push({ method: 'upsert', arguments: [value, options] })
    return this
  }

  single(): Promise<SupabaseResult> {
    this.operations.push({ method: 'single', arguments: [] })
    return Promise.resolve(this.result)
  }
}

class FakeSupabaseClient {
  readonly queries: Array<{ table: string; builder: FakeQueryBuilder }> = []
  readonly rpcCalls: Array<{ name: string; arguments: Record<string, unknown> }> = []
  queryResults = new Map<string, SupabaseResult>()
  rpcResults = new Map<string, SupabaseResult>()

  from(table: string): FakeQueryBuilder {
    const builder = new FakeQueryBuilder(
      this.queryResults.get(table) ?? { data: [], error: null },
    )
    this.queries.push({ table, builder })
    return builder
  }

  rpc(name: string, args: Record<string, unknown>): Promise<SupabaseResult> {
    this.rpcCalls.push({ name, arguments: args })
    return Promise.resolve(
      this.rpcResults.get(name) ?? { data: null, error: null },
    )
  }
}

const memberId = '11111111-1111-4111-8111-111111111111'
const dishId = '44444444-4444-4444-8444-444444444444'
const date = '2026-10-22'
const catalogRow = {
  dish_id: dishId,
  display_order: 1,
  is_active: true,
  dishes: {
    id: dishId,
    name: 'Synthetic Dish',
    is_active: true,
  },
}
const memberRow = {
  id: memberId,
  display_name: 'Synthetic Member',
  role: 'MEMBER',
  avatar_type: null,
  avatar_value: null,
  is_active: true,
}
const selectedRow = {
  member_id: memberId,
  breakfast_date: date,
  selection_type: 'SELECTED',
  dish_id: dishId,
  custom_dish_name: null,
  created_at: '2026-10-21T10:00:00.000Z',
  updated_at: '2026-10-21T11:00:00.000Z',
  dishes: { id: dishId, name: 'Synthetic Dish' },
}
const purchaseRow = {
  id: '55555555-5555-4555-8555-555555555555',
  breakfast_date: date,
  confirmed_by_member_id: '33333333-3333-4333-8333-333333333333',
  confirmed_by_display_name: 'Synthetic Parent',
  message: 'Breakfast is ready',
  purchased_at: '2026-10-21T12:00:00.000Z',
  created_at: '2026-10-21T12:00:00.000Z',
  updated_at: '2026-10-21T12:00:00.000Z',
}

function createHarness(client = new FakeSupabaseClient()) {
  const repository = new SupabaseBreakfastRepository(
    () => client as unknown as SupabaseClient,
  )
  return { client, repository }
}

describe('SupabaseBreakfastRepository catalog and members', () => {
  it('maps active catalog rows in display order', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_catalog', {
      data: [catalogRow],
      error: null,
    })

    await expect(repository.listActiveCatalog()).resolves.toEqual([
      { id: dishId, name: 'Synthetic Dish', displayOrder: 1 },
    ])
    expect(client.queries[0]!.builder.operations).toEqual([
      {
        method: 'select',
        arguments: ['dish_id, display_order, is_active, dishes!inner(id, name, is_active)'],
      },
      { method: 'eq', arguments: ['is_active', true] },
      { method: 'eq', arguments: ['dishes.is_active', true] },
      { method: 'order', arguments: ['display_order', { ascending: true }] },
    ])
  })

  it('maps active members without credential fields', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('family_members', {
      data: [memberRow],
      error: null,
    })

    await expect(repository.listActiveMembers()).resolves.toEqual([
      {
        id: memberId,
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType: null,
        avatarValue: null,
      },
    ])
    expect(client.queries[0]!.builder.operations).toEqual([
      {
        method: 'select',
        arguments: [
          'id, display_name, role, avatar_type, avatar_value, is_active',
        ],
      },
      { method: 'eq', arguments: ['is_active', true] },
      { method: 'order', arguments: ['display_name', { ascending: true }] },
    ])
  })

  it('finds one active catalog item or returns null', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_catalog', {
      data: catalogRow,
      error: null,
    })

    await expect(repository.findActiveCatalogItem(dishId)).resolves.toEqual({
      id: dishId,
      name: 'Synthetic Dish',
      displayOrder: 1,
    })
    expect(client.queries[0]!.builder.operations.at(-1)).toEqual({
      method: 'maybeSingle',
      arguments: [],
    })

    const empty = createHarness()
    empty.client.queryResults.set('breakfast_catalog', {
      data: null,
      error: null,
    })
    await expect(empty.repository.findActiveCatalogItem(dishId)).resolves.toBeNull()
  })
})

describe('SupabaseBreakfastRepository selections', () => {
  it('maps selected, custom, and not-eating records for only requested members', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_selections', {
      data: [
        selectedRow,
        {
          ...selectedRow,
          member_id: '22222222-2222-4222-8222-222222222222',
          selection_type: 'CUSTOM',
          dish_id: null,
          custom_dish_name: 'Synthetic noodles',
          dishes: null,
        },
        {
          ...selectedRow,
          member_id: '33333333-3333-4333-8333-333333333333',
          selection_type: 'NOT_EATING',
          dish_id: null,
          dishes: null,
        },
      ],
      error: null,
    })
    const ids = [
      memberId,
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ]

    const records = await repository.listSelections(date, ids)

    expect(records.map((record) => record.state)).toEqual([
      'SELECTED',
      'CUSTOM',
      'NOT_EATING',
    ])
    expect(records[0]?.catalogItem).toEqual({
      id: dishId,
      name: 'Synthetic Dish',
    })
    expect(records[1]?.customText).toBe('Synthetic noodles')
    expect(client.queries[0]!.builder.operations).toContainEqual({
      method: 'in',
      arguments: ['member_id', ids],
    })
  })

  it('upserts by member and breakfast date and returns the safe record', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_selections', {
      data: selectedRow,
      error: null,
    })

    await expect(
      repository.upsertSelection({
        memberId,
        breakfastDate: date,
        state: 'SELECTED',
        dishId,
        customText: null,
      }),
    ).resolves.toMatchObject({
      memberId,
      breakfastDate: date,
      state: 'SELECTED',
    })
    expect(client.queries[0]!.builder.operations[0]).toEqual({
      method: 'upsert',
      arguments: [
        {
          member_id: memberId,
          breakfast_date: date,
          selection_type: 'SELECTED',
          dish_id: dishId,
          custom_dish_name: null,
        },
        { onConflict: 'member_id,breakfast_date' },
      ],
    })
    expect(client.queries[0]!.builder.operations.at(-1)).toEqual({
      method: 'single',
      arguments: [],
    })
  })

  it('returns no rows and performs no query for an empty member scope', async () => {
    const { client, repository } = createHarness()

    await expect(repository.listSelections(date, [])).resolves.toEqual([])
    expect(client.queries).toEqual([])
  })

  it('rejects malformed rows and upstream details with one safe error', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_selections', {
      data: [{ ...selectedRow, selection_type: 'NO_RESPONSE' }],
      error: { message: 'secret upstream detail' },
    })

    const result = repository.listSelections(date, [memberId])

    await expect(result).rejects.toBeInstanceOf(BreakfastDataError)
    await expect(result).rejects.not.toThrow('secret upstream detail')
  })
})

describe('SupabaseBreakfastRepository purchases', () => {
  it('finds and safely maps the purchase for a breakfast date', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_purchases', {
      data: {
        ...purchaseRow,
        family_members: { id: purchaseRow.confirmed_by_member_id, display_name: 'Synthetic Parent' },
      },
      error: null,
    })

    await expect(repository.findPurchase(date)).resolves.toMatchObject({
      id: purchaseRow.id,
      breakfastDate: date,
      confirmedBy: {
        id: purchaseRow.confirmed_by_member_id,
        displayName: 'Synthetic Parent',
      },
      message: 'Breakfast is ready',
    })
    expect(client.queries[0]!.builder.operations).toContainEqual({
      method: 'eq',
      arguments: ['breakfast_date', date],
    })
    expect(client.queries[0]!.builder.operations.at(-1)).toEqual({
      method: 'maybeSingle',
      arguments: [],
    })
  })

  it('returns null when no purchase exists', async () => {
    const { client, repository } = createHarness()
    client.queryResults.set('breakfast_purchases', { data: null, error: null })
    await expect(repository.findPurchase(date)).resolves.toBeNull()
  })

  it('confirms through the atomic RPC and maps its single row', async () => {
    const { client, repository } = createHarness()
    client.rpcResults.set('confirm_breakfast_purchase', {
      data: [purchaseRow],
      error: null,
    })

    await expect(
      repository.confirmPurchase({
        actorMemberId: '33333333-3333-4333-8333-333333333333',
        breakfastDate: date,
        message: 'Breakfast is ready',
      }),
    ).resolves.toMatchObject({ id: purchaseRow.id, breakfastDate: date })
    expect(client.rpcCalls).toEqual([
      {
        name: 'confirm_breakfast_purchase',
        arguments: {
          p_actor_member_id: '33333333-3333-4333-8333-333333333333',
          p_breakfast_date: date,
          p_message: 'Breakfast is ready',
        },
      },
    ])
  })

  it('rejects malformed or failed purchase results with a safe error', async () => {
    const { client, repository } = createHarness()
    client.rpcResults.set('confirm_breakfast_purchase', {
      data: [{ ...purchaseRow, id: 'not-a-uuid' }],
      error: { message: 'secret upstream detail' },
    })

    const result = repository.confirmPurchase({
      actorMemberId: memberId,
      breakfastDate: date,
      message: null,
    })
    await expect(result).rejects.toBeInstanceOf(BreakfastDataError)
    await expect(result).rejects.not.toThrow('secret upstream detail')
  })
})
