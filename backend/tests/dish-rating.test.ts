import express from 'express'
import request from 'supertest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { DishRatingService } from '../src/services/dish-rating.service.js'
import { SupabaseDishRatingRepository } from '../src/repositories/dish-rating.repository.js'
import { createDishRatingRouter } from '../src/routes/dish-rating.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import realApp from '../src/app.js'
import { SupabaseAuthSessionRepository } from '../src/repositories/auth-session.repository.js'
import { generateSessionToken } from '../src/security/session-token.js'
import {
  UnauthenticatedError,
  type FamilySessionOperations,
} from '../src/services/family-session.service.js'

const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const profile = {
  id,
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const rating = {
  rating: 5,
  comment: 'Ngon lắm',
  memberId: id,
  displayName: profile.displayName,
  createdAt: '2099-01-01T00:00:00Z',
  updatedAt: '2099-01-01T00:00:00Z',
}
const state = {
  mealId: id,
  ready: true,
  dishes: [
    {
      id: other,
      name: 'Thịt kho',
      category: 'MAIN',
      sortOrder: 0,
      ratings: [rating],
    },
  ],
}
function setup(data: unknown = state, code?: string) {
  const rpc = vi.fn().mockResolvedValue({
    data,
    error: code ? { code, message: 'private database detail' } : null,
  })
  const repository = new SupabaseDishRatingRepository(
    () => ({ rpc }) as unknown as SupabaseClient,
  )
  return { rpc, repository, service: new DishRatingService(repository) }
}
describe('dish rating service and repository boundary', () => {
  it.each(['ADMIN', 'MEMBER'] as const)(
    'saves %s with session ownership and trimmed comment',
    async (role) => {
      const { service, rpc } = setup(rating)
      expect(
        await service.save({ ...profile, role }, other, {
          rating: 5,
          comment: '  Ngon lắm  ',
        }),
      ).toEqual(rating)
      expect(rpc).toHaveBeenCalledExactlyOnceWith(
        'save_final_meal_dish_rating',
        {
          p_actor_member_id: id,
          p_dish_id: other,
          p_rating: 5,
          p_comment: 'Ngon lắm',
        },
      )
    },
  )
  it('denies parent before accessing database', async () => {
    const { service, rpc } = setup()
    await expect(
      service.save({ ...profile, role: 'PARENT' }, other, { rating: 5 }),
    ).rejects.toMatchObject({ status: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([0, 6, 2.5, '5', null, undefined])(
    'rejects invalid rating %s',
    async (rating) => {
      const { service, rpc } = setup()
      await expect(
        service.save(profile, other, { rating }),
      ).rejects.toMatchObject({ status: 400 })
      expect(rpc).not.toHaveBeenCalled()
    },
  )
  it.each([
    { rating: 4, memberId: other },
    { rating: 4, comment: 'a'.repeat(301) },
    { rating: 4, comment: 42 },
    null,
  ])('rejects forged ownership or invalid comment %#', async (input) => {
    await expect(
      setup().service.save(profile, other, input),
    ).rejects.toMatchObject({ status: 400 })
  })
  it('normalizes blank comments to null and permits the 300-character boundary', async () => {
    const { service, rpc } = setup(rating)
    await service.save(profile, other, { rating: 1, comment: '   ' })
    expect(rpc.mock.calls[0]![1].p_comment).toBeNull()
    await service.save(profile, other, { rating: 3, comment: 'a'.repeat(300) })
    expect(rpc.mock.calls[1]![1].p_comment).toHaveLength(300)
  })
  it.each([
    ['42501', 403],
    ['P0002', 404],
    ['P2002', 409],
    ['22023', 400],
    ['XX000', 503],
  ])('maps database rejection %s safely', async (code, status) => {
    await expect(
      setup(null, code as string).service.save(profile, other, { rating: 4 }),
    ).rejects.toMatchObject({ status })
  })
  it('reads with actor and meal scope, never a caller-supplied role', async () => {
    const { service, rpc } = setup()
    expect(await service.get(profile, id)).toEqual(state)
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      'read_final_meal_dish_ratings',
      { p_actor_member_id: id, p_meal_id: id },
    )
  })
  it.each(['bad', undefined])(
    'rejects invalid resource IDs %s',
    async (value) => {
      await expect(setup().service.get(profile, value)).rejects.toMatchObject({
        status: 400,
      })
      await expect(
        setup().service.save(profile, value, { rating: 4 }),
      ).rejects.toMatchObject({ status: 400 })
    },
  )
  it('rejects malformed persistence data without leaking it', async () => {
    await expect(
      setup({
        ...state,
        dishes: [{ id: other, ratings: 'private' }],
      }).service.get(profile, id),
    ).rejects.toMatchObject({ status: 503 })
  })
  it('projects only safe feedback fields', async () => {
    const { service } = setup({
      ...state,
      private: 'hidden',
      dishes: [
        { ...state.dishes[0], ratings: [{ ...rating, pin_hash: 'hidden' }] },
      ],
    })
    expect(JSON.stringify(await service.get(profile, id))).not.toContain(
      'hidden',
    )
  })
})

describe('dish rating authenticated API', () => {
  it('saves feedback through the actual app with session ownership', async () => {
    const sessions = vi
      .spyOn(
        SupabaseAuthSessionRepository.prototype,
        'findAuthenticatedSession',
      )
      .mockResolvedValue({ sessionId: id, profile })
    const ratings = vi
      .spyOn(SupabaseDishRatingRepository.prototype, 'save')
      .mockResolvedValue(rating)
    try {
      const response = await request(realApp)
        .put(`/api/meals/dishes/${other}/rating`)
        .set('Cookie', `family_session=${generateSessionToken()}`)
        .send({ rating: 5, comment: ' Ngon lắm ' })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ rating })
      expect(ratings).toHaveBeenCalledExactlyOnceWith(id, other, 5, 'Ngon lắm')
    } finally {
      sessions.mockRestore()
      ratings.mockRestore()
    }
  })
  it('reaches feedback through the actual app without the slot route intercepting', async () => {
    const sessions = vi
      .spyOn(
        SupabaseAuthSessionRepository.prototype,
        'findAuthenticatedSession',
      )
      .mockResolvedValue({ sessionId: id, profile })
    const ratings = vi
      .spyOn(SupabaseDishRatingRepository.prototype, 'get')
      .mockResolvedValue(state)
    try {
      const response = await request(realApp)
        .get(`/api/meals/final/${id}/ratings`)
        .set('Cookie', `family_session=${generateSessionToken()}`)
      expect(response.status).toBe(200)
      expect(response.body.feedback.dishes[0].ratings[0].comment).toBe(
        'Ngon lắm',
      )
    } finally {
      sessions.mockRestore()
      ratings.mockRestore()
    }
  })
  function app(
    authenticated = true,
    role: 'MEMBER' | 'PARENT' = 'MEMBER',
    code?: string,
  ) {
    const { service, rpc } = setup(state, code)
    const sessions: FamilySessionOperations = {
      async authenticate() {
        if (!authenticated) throw new UnauthenticatedError()
        return { sessionId: id, profile: { ...profile, role } }
      },
      async createSession() {
        throw new Error('unused')
      },
      async logout() {},
    }
    const server = express()
    server.use(express.json())
    server.use('/api/meals', createDishRatingRouter(service, sessions))
    server.use(errorHandler)
    return { server, rpc }
  }
  it.each(['get', 'put'] as const)(
    'requires active session for %s',
    async (method) => {
      const { server } = app(false)
      const response =
        method === 'get'
          ? await request(server).get(`/api/meals/final/${id}/ratings`)
          : await request(server)
              .put(`/api/meals/dishes/${other}/rating`)
              .send({ rating: 5 })
      expect(response.status).toBe(401)
    },
  )
  it('reads safe meal feedback for parent', async () => {
    const response = await request(app(true, 'PARENT').server).get(
      `/api/meals/final/${id}/ratings`,
    )
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ feedback: state })
  })
  it('rejects attempts to overwrite another member and parent writes', async () => {
    const forged = await request(app().server)
      .put(`/api/meals/dishes/${other}/rating`)
      .send({ rating: 4, memberId: other })
    expect(forged.status).toBe(400)
    const parent = await request(app(true, 'PARENT').server)
      .put(`/api/meals/dishes/${other}/rating`)
      .send({ rating: 4 })
    expect(parent.status).toBe(403)
  })
  it('returns safe unavailable errors', async () => {
    const response = await request(app(true, 'MEMBER', 'XX000').server).get(
      `/api/meals/final/${id}/ratings`,
    )
    expect(response.status).toBe(503)
    expect(JSON.stringify(response.body)).not.toMatch(/private|stack|pin_hash/)
  })
})
