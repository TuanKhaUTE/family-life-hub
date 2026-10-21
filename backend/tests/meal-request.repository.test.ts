import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  MealRequestDataError,
  SupabaseMealRequestRepository,
} from '../src/repositories/meal-request.repository.js'
import { MealRequestConflictError } from '../src/services/meal-request.service.js'

interface Result {
  data: unknown
  error: { code?: string } | null
}
class Builder implements PromiseLike<Result> {
  operations: Array<[string, ...unknown[]]> = []
  constructor(private result: Result) {}
  select(value: string) {
    this.operations.push(['select', value])
    return this
  }
  gte(column: string, value: unknown) {
    this.operations.push(['gte', column, value])
    return this
  }
  eq(column: string, value: unknown) {
    this.operations.push(['eq', column, value])
    return this
  }
  in(column: string, value: unknown) {
    this.operations.push(['in', column, value])
    return this
  }
  order(column: string, options?: unknown) {
    this.operations.push(['order', column, options])
    return this
  }
  maybeSingle() {
    this.operations.push(['maybeSingle'])
    return Promise.resolve(this.result)
  }
  // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are intentionally Promise-like.
  then<TResult1 = Result, TResult2 = never>(
    resolve?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}
class Client {
  result: Result = { data: [], error: null }
  builder?: Builder
  rpcCalls: Array<{ name: string; args: unknown }> = []
  rpcResult: Result = {
    data: '44444444-4444-4444-8444-444444444444',
    error: null,
  }
  from() {
    this.builder = new Builder(this.result)
    return this.builder
  }
  rpc(name: string, args: unknown) {
    this.rpcCalls.push({ name, args })
    return Promise.resolve(this.rpcResult)
  }
}
const requestId = '44444444-4444-4444-8444-444444444444'
const optionId = '33333333-3333-4333-8333-333333333333'
const row = {
  id: requestId,
  meal_date: '2026-10-21',
  meal_type: 'DINNER',
  mode: 'OPTION_POLL',
  status: 'OPEN',
  deadline_at: '2026-10-21T12:00:00Z',
  parent_message: null,
  created_at: '2026-10-21T07:00:00Z',
  updated_at: '2026-10-21T07:00:00Z',
  family_members: {
    id: '11111111-1111-4111-8111-111111111111',
    display_name: 'Synthetic Parent',
  },
  meal_request_options: [{ id: optionId, label: 'Rice', sort_order: 1 }],
}
function harness() {
  const client = new Client()
  return {
    client,
    repository: new SupabaseMealRequestRepository(
      () => client as unknown as SupabaseClient,
    ),
  }
}

describe('SupabaseMealRequestRepository', () => {
  it('maps current requests and preserves ordered options', async () => {
    const { client, repository } = harness()
    client.result = { data: [row], error: null }
    await expect(repository.listCurrentRequests('2026-10-21')).resolves.toEqual(
      [
        {
          id: requestId,
          mealDate: '2026-10-21',
          mealType: 'DINNER',
          mode: 'OPTION_POLL',
          status: 'OPEN',
          deadlineAt: '2026-10-21T12:00:00Z',
          parentMessage: null,
          createdBy: {
            id: row.family_members.id,
            displayName: 'Synthetic Parent',
          },
          options: [{ id: optionId, label: 'Rice', sortOrder: 1 }],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      ],
    )
    expect(client.builder!.operations).toContainEqual([
      'gte',
      'meal_date',
      '2026-10-21',
    ])
  })

  it('uses the atomic creation RPC with server-owned actor context', async () => {
    const { client, repository } = harness()
    await repository.createRequest({
      actorMemberId: row.family_members.id,
      mealDate: '2026-10-21',
      mealType: 'DINNER',
      mode: 'OPTION_POLL',
      deadlineAt: row.deadline_at,
      parentMessage: null,
      options: ['Rice', 'Noodles'],
    })
    expect(client.rpcCalls[0]).toEqual({
      name: 'create_meal_request',
      args: {
        p_actor_member_id: row.family_members.id,
        p_meal_date: '2026-10-21',
        p_meal_type: 'DINNER',
        p_mode: 'OPTION_POLL',
        p_deadline_at: row.deadline_at,
        p_parent_message: null,
        p_options: ['Rice', 'Noodles'],
      },
    })
  })

  it('maps a database slot collision to a safe conflict', async () => {
    const { client, repository } = harness()
    client.rpcResult = { data: null, error: { code: '23505' } }
    await expect(
      repository.createRequest({
        actorMemberId: row.family_members.id,
        mealDate: '2026-10-21',
        mealType: 'DINNER',
        mode: 'OPEN_CHOICE',
        deadlineAt: row.deadline_at,
        parentMessage: null,
        options: [],
      }),
    ).rejects.toBeInstanceOf(MealRequestConflictError)
  })

  it('uses the atomic self-service plan-change RPC', async () => {
    const { client, repository } = harness()
    await repository.changeSelfServiceRequest({
      actorMemberId: row.family_members.id,
      requestId,
      mode: 'OPTION_POLL',
      deadlineAt: row.deadline_at,
      parentMessage: 'New plan',
      options: ['Rice', 'Noodles'],
    })
    expect(client.rpcCalls[0]).toEqual({
      name: 'change_self_service_meal_request',
      args: {
        p_actor_member_id: row.family_members.id,
        p_request_id: requestId,
        p_mode: 'OPTION_POLL',
        p_deadline_at: row.deadline_at,
        p_parent_message: 'New plan',
        p_options: ['Rice', 'Noodles'],
      },
    })
  })

  it('rejects malformed database rows', async () => {
    const { client, repository } = harness()
    client.result = { data: [{ ...row, id: 'bad' }], error: null }
    await expect(
      repository.listCurrentRequests('2026-10-21'),
    ).rejects.toBeInstanceOf(MealRequestDataError)
  })
})
