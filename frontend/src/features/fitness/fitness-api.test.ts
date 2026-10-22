import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchFitness,
  saveFitness,
  deleteFitness,
  FitnessApiError,
  fitnessError,
} from './fitness-api'
const id = '11111111-1111-4111-8111-111111111111'
const summary = {
  weekStart: '2026-10-19',
  weekEnd: '2026-10-25',
  sessionsThisWeek: 2,
  weeklyTarget: 3,
  completionPercent: 67,
  totalMinutes: 115,
  unrecordedDurationCount: 0,
  nextWorkout: null,
}
afterEach(() => vi.unstubAllGlobals())
describe('private Fitness client', () => {
  it('uses session credentials and reconstructs only the safe response fields', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            fitness: {
              plans: [
                {
                  id,
                  name: 'Synthetic',
                  note: null,
                  isActive: true,
                  owner_member_id: 'private',
                },
              ],
              days: [],
              goals: [],
              sessions: [],
              summary: { ...summary, secret: 'private' },
            },
          }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    const result = await fetchFitness(signal)
    expect(JSON.stringify(result)).not.toContain('private')
    expect(fetch).toHaveBeenCalledWith('/api/fitness', {
      signal,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })
  it.each([
    {},
    null,
    {
      fitness: {
        plans: [],
        days: [],
        goals: [],
        sessions: [],
        summary: { ...summary, completionPercent: 101 },
      },
    },
    {
      fitness: {
        plans: [],
        days: [],
        goals: [],
        sessions: [],
        summary: { ...summary, unrecordedDurationCount: 3 },
      },
    },
  ])('rejects malformed or contradictory summaries', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
    )
    await expect(fetchFitness(new AbortController().signal)).rejects.toThrow(
      'Fitness unavailable',
    )
  })
  it('updates/deletes existing identities without owner fields', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await saveFitness('goals', id, { weeklySessionTarget: 3, isActive: true })
    await deleteFitness('sessions', id)
    expect(fetch.mock.calls[0][0]).toBe(`/api/fitness/goals/${id}`)
    expect(fetch.mock.calls[0][1].method).toBe('PUT')
    expect(fetch.mock.calls[1][1].method).toBe('DELETE')
    expect(fetch.mock.calls[0][1].body).not.toContain('owner')
  })
  it('does not display backend error details and gives actionable duplicate-weekday guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                code: 'FITNESS_FORBIDDEN',
                message: 'private SQL detail',
              },
            }),
            { status: 403 },
          ),
        ),
    )
    await expect(
      fetchFitness(new AbortController().signal),
    ).rejects.toMatchObject({ code: 'FITNESS_FORBIDDEN' })
    expect(fitnessError(new FitnessApiError('FITNESS_DAY_EXISTS'))).toContain(
      'chỉnh sửa buổi đang có',
    )
    expect(fitnessError(new Error('private SQL detail'))).not.toContain('SQL')
  })
})
