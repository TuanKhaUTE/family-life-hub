import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createFinalMealRouter } from '../src/routes/final-meal.routes.js'
import {
  FinalMealService,
  type FinalMealRepository,
} from '../src/services/final-meal.service.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import {
  UnauthenticatedError,
  type FamilySessionOperations,
} from '../src/services/family-session.service.js'
import { SESSION_COOKIE_NAME } from '../src/http/session-cookie.js'
import { generateSessionToken } from '../src/security/session-token.js'

const token = generateSessionToken()
const member = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Parent',
  role: 'PARENT' as const,
  avatarType: null,
  avatarValue: null,
}
const meal = {
  id: member.id,
  mealDate: '2099-05-01',
  mealType: 'DINNER' as const,
  mealRequestId: null,
  finalizedByMemberId: member.id,
  readyAt: null,
  readyMessage: null,
  createdAt: '2099-05-01T00:00:00Z',
  updatedAt: '2099-05-01T00:00:00Z',
  dishes: [{ name: 'Cơm', category: 'MAIN' as const, sortOrder: 0 }],
}
function setup(role: 'PARENT' | 'ADMIN' | 'MEMBER' = 'PARENT', fail = false) {
  const calls: unknown[] = []
  const repository: FinalMealRepository = {
    async get() {
      if (fail) throw new Error('private database detail')
      return meal
    },
    async save(input) {
      calls.push(input)
      return meal
    },
    async ready(input) {
      calls.push(input)
      return {
        ...meal,
        readyAt: '2099-05-01T12:00:00Z',
        readyMessage: input.readyMessage,
      }
    },
  }
  const sessions: FamilySessionOperations = {
    async createSession() {
      throw new Error()
    },
    async authenticate(value) {
      if (value !== token) throw new UnauthenticatedError()
      return { sessionId: member.id, profile: { ...member, role } }
    },
    async logout() {},
  }
  const app = express()
  app.use(express.json())
  app.use(
    '/api/meals/final',
    createFinalMealRouter(new FinalMealService(repository), sessions),
  )
  app.use(errorHandler)
  return { app, calls }
}
const url = '/api/meals/final/2099-05-01/DINNER'
function auth(test: request.Test) {
  return test.set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)
}
describe('final meal API', () => {
  it.each(['get', 'put', 'ready'])(
    'requires session for %s',
    async (action) => {
      const { app } = setup()
      const result =
        action === 'get'
          ? await request(app).get(url)
          : await request(app)
              .put(action === 'ready' ? `${url}/ready` : url)
              .send({ dishes: meal.dishes })
      expect(result.status).toBe(401)
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    'allows %s read but denies writes and ready',
    async (role) => {
      const { app, calls } = setup(role)
      expect((await auth(request(app).get(url))).body).toEqual({ meal })
      expect(
        (await auth(request(app).put(url).send({ dishes: meal.dishes })))
          .status,
      ).toBe(403)
      expect(
        (await auth(request(app).put(`${url}/ready`).send({}))).status,
      ).toBe(403)
      expect(calls).toHaveLength(0)
    },
  )
  it('saves with the session actor and returns ready state', async () => {
    const { app, calls } = setup()
    expect(
      (await auth(request(app).put(url).send({ dishes: meal.dishes }))).body,
    ).toEqual({ meal })
    expect(calls[0]).toMatchObject({
      actorMemberId: member.id,
      mealRequestId: null,
    })
    const result = await auth(
      request(app).put(`${url}/ready`).send({ readyMessage: 'Cả nhà ăn nhé' }),
    )
    expect(result.status).toBe(200)
    expect(result.body.meal.readyAt).toBeTruthy()
  })
  it('rejects forged actor IDs', async () => {
    expect(
      (
        await auth(
          request(setup().app)
            .put(url)
            .send({ dishes: meal.dishes, actorMemberId: member.id }),
        )
      ).status,
    ).toBe(400)
  })
  it('returns safe unavailable errors', async () => {
    const result = await auth(request(setup('PARENT', true).app).get(url))
    expect(result.status).toBe(503)
    expect(JSON.stringify(result.body)).not.toMatch(/private|stack/)
  })
})
