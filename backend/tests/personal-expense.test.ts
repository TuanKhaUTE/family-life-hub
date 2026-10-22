import request from 'supertest'
import { expect, it, vi } from 'vitest'
import app from '../src/app.js'
import express from 'express'
import {
  PersonalExpenseService,
  expenseComparison,
  type PersonalExpenseRepository,
} from '../src/services/personal-expense.service.js'
import { createPersonalExpenseRouter } from '../src/routes/personal-expense.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
import { ApiError } from '../src/errors/api-error.js'

const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222'
const input = {
  amount: '120000',
  spentOn: '2026-10-22',
  category: 'TRANSPORT',
  note: ' Synthetic expense ',
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const repository: PersonalExpenseRepository = {
    read: vi.fn(async () => ({
      expenses: [{ id, ...input, note: 'Synthetic expense' }],
      totalCount: 1,
      currentTotal: '1250000',
      previousTotal: '1000000',
      categories: [{ category: 'TRANSPORT' as const, amount: '1250000' }],
    })),
    mutate: vi.fn(async () => {}),
  }
  const actor: SafeFamilyProfile = {
    id,
    role,
    displayName: 'Synthetic Expense',
    avatarType: null,
    avatarValue: null,
  }
  const service = new PersonalExpenseService(
    repository,
    () => new Date('2026-10-21T19:00:00Z'),
  )
  const sessions = {
    authenticate: async () => ({
      sessionId: 'private-session',
      profile: actor,
    }),
  } as unknown as FamilySessionOperations
  return {
    actor,
    service,
    repository,
    app: express()
      .use(express.json())
      .use(
        '/api/expenses/personal',
        createPersonalExpenseRouter(service, sessions),
      )
      .use(errorHandler),
  }
}

it('requires a session before exposing personal expenses', async () => {
  expect((await request(app).get('/api/expenses/personal')).status).toBe(401)
})
it('requires a session for every personal-expense mutation', async () => {
  expect(
    (await request(app).post('/api/expenses/personal').send(input)).status,
  ).toBe(401)
  expect(
    (await request(app).put(`/api/expenses/personal/${id}`).send(input)).status,
  ).toBe(401)
  expect(
    (await request(app).delete(`/api/expenses/personal/${id}`)).status,
  ).toBe(401)
})
it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
  '%s CRUD is scoped exclusively to the session owner',
  async (role) => {
    const s = setup(role)
    const response = await request(s.app).get(
      `/api/expenses/personal?ownerMemberId=${other}`,
    )
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(s.repository.read).toHaveBeenCalledWith(id, '2026-10', 1)
    expect(response.body.personalExpenses).toMatchObject({
      month: '2026-10',
      currency: 'VND',
      totalCount: 1,
      page: 1,
      hasMore: false,
      summary: {
        currentTotal: '1250000',
        previousTotal: '1000000',
        previousMonth: '2026-09',
        differenceAmount: '250000',
        percentageChange: 25,
      },
    })
    expect(
      (await request(s.app).post('/api/expenses/personal').send(input)).status,
    ).toBe(204)
    expect(
      (await request(s.app).put(`/api/expenses/personal/${other}`).send(input))
        .status,
    ).toBe(204)
    expect(
      (await request(s.app).delete(`/api/expenses/personal/${other}`)).status,
    ).toBe(204)
    expect(
      vi.mocked(s.repository.mutate).mock.calls.every((c) => c[0] === id),
    ).toBe(true)
    expect(vi.mocked(s.repository.mutate).mock.calls[0]![2]).toMatchObject({
      amount: '120000',
      note: 'Synthetic expense',
    })
  },
)
it.each([
  { ...input, amount: 120000 },
  { ...input, amount: '0' },
  { ...input, amount: '-1' },
  { ...input, amount: '120.5' },
  { ...input, amount: '1e5' },
  { ...input, amount: '1000000001' },
  { ...input, amount: '0120000' },
  { ...input, amount: '9007199254740993' },
  { ...input, spentOn: '2026-02-30' },
  { ...input, spentOn: '2026-10-23' },
  { ...input, category: 'HOUSEHOLD_FOOD' },
  { ...input, note: 'x'.repeat(1001) },
  { ...input, ownerMemberId: other },
  { ...input, owner_member_id: other },
  { ...input, currency: 'USD' },
])(
  'rejects unsafe amount/date/category/owner input before storage',
  async (body) => {
    const s = setup()
    expect(
      (await request(s.app).post('/api/expenses/personal').send(body)).status,
    ).toBe(400)
    expect(s.repository.mutate).not.toHaveBeenCalled()
  },
)
it.each([
  '?month=2026-13',
  '?month=1999-12',
  '?month=2026-1',
  '?month=2026-10&month=2026-11',
  '?page=0',
  '?page=-1',
  '?page=1.5',
  '?page=100001',
])('rejects invalid filtering %s', async (query) => {
  const s = setup()
  expect(
    (await request(s.app).get('/api/expenses/personal' + query)).status,
  ).toBe(400)
  expect(s.repository.read).not.toHaveBeenCalled()
})
it('filters and paginates without truncating monthly summary and handles January rollover', async () => {
  const s = setup()
  const r = await request(s.app).get(
    '/api/expenses/personal?month=2026-01&page=2',
  )
  expect(r.status).toBe(200)
  expect(s.repository.read).toHaveBeenCalledWith(id, '2026-01', 2)
  expect(r.body.personalExpenses.summary.previousMonth).toBe('2025-12')
  expect(r.body.personalExpenses.summary.currentTotal).toBe('1250000')
})
it.each([
  ['0', '0', '0', null],
  ['120000', '0', '120000', null],
  ['0', '120000', '-120000', -100],
  ['1000000', '1250000', '-250000', -20],
  ['2', '3', '-1', -33.3],
  ['9007199254740993', '9007199254740992', '1', 0],
] as const)(
  'compares %s against %s exactly and honestly',
  (current, previous, difference, percent) => {
    expect(expenseComparison(current, previous)).toEqual({
      differenceAmount: difference,
      percentageChange: percent,
    })
  },
)
it('uses identical safe not-found errors for inaccessible or missing expenses', async () => {
  const s = setup('ADMIN')
  vi.mocked(s.repository.mutate).mockRejectedValue(
    new ApiError(404, 'EXPENSE_NOT_FOUND', 'Personal expense not found'),
  )
  expect(
    (await request(s.app).delete(`/api/expenses/personal/${other}`)).status,
  ).toBe(404)
})
it('does not expose unexpected database details', async () => {
  const s = setup()
  vi.mocked(s.repository.read).mockRejectedValue(
    new Error('private SQL credential'),
  )
  const r = await request(s.app).get('/api/expenses/personal')
  expect(r.status).toBe(503)
  expect(JSON.stringify(r.body)).not.toMatch(/SQL|credential|stack/)
})
