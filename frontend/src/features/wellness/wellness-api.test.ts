import { afterEach, expect, it, vi } from 'vitest'
import {
  fetchWellness,
  saveWellnessProfile,
  saveWeight,
  deleteWeight,
  wellnessError,
  WellnessApiError,
} from './wellness-api'
const id = '11111111-1111-4111-8111-111111111111'
const summary = {
  currentWeightKg: 62.5,
  currentLoggedDate: '2026-10-22',
  previousWeightKg: null,
  previousLoggedDate: null,
  changeKg: null,
  bmi: 20.6,
  trend7: null,
  trend30: null,
}
const data = {
  profile: { heightCm: 174, targetWeightKg: null, activityLevel: null },
  logs: [{ id, loggedDate: '2026-10-22', weightKg: 62.5, note: null }],
  summary,
}
afterEach(() => vi.unstubAllGlobals())
it('reads through the backend session and reconstructs only safe Wellness fields', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        wellness: {
          profile: { ...data.profile, secret: 'private' },
          logs: [{ ...data.logs[0], owner_member_id: 'private' }],
          summary: { ...summary, secret: 'private' },
        },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const signal = new AbortController().signal
  expect(await fetchWellness(signal)).toEqual(data)
  expect(fetch).toHaveBeenCalledWith('/api/wellness', {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
})
it.each([
  {},
  { wellness: { ...data, profile: { ...data.profile, heightCm: 500 } } },
  { wellness: { ...data, logs: [{ ...data.logs[0], weightKg: '62.5' }] } },
  { wellness: { ...data, summary: { ...summary, bmi: '20.6' } } },
  {
    wellness: {
      ...data,
      summary: {
        ...summary,
        trend7: {
          fromDate: '2026-10-22',
          toDate: '2026-10-22',
          changeKg: 1,
          pointCount: 1,
        },
      },
    },
  },
])(
  'rejects malformed measurements and fabricated trend spans',
  async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
    )
    await expect(fetchWellness(new AbortController().signal)).rejects.toThrow(
      'Wellness unavailable',
    )
  },
)
it('uses identity-preserving log mutations and no owner authority in profile writes', async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  await saveWellnessProfile(data.profile)
  await saveWeight(null, {
    loggedDate: '2026-10-22',
    weightKg: 62.5,
    note: null,
  })
  await saveWeight(id, { loggedDate: '2026-10-22', weightKg: 63, note: null })
  await deleteWeight(id)
  expect(fetch.mock.calls.map((c) => [c[0], c[1].method])).toEqual([
    ['/api/wellness/profile', 'PUT'],
    ['/api/wellness/logs', 'POST'],
    [`/api/wellness/logs/${id}`, 'PUT'],
    [`/api/wellness/logs/${id}`, 'DELETE'],
  ])
  expect(JSON.stringify(fetch.mock.calls)).not.toMatch(
    /owner_member_id|ownerMemberId/,
  )
})
it('does not expose server/network details and gives actionable duplicate feedback', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'WELLNESS_DATE_EXISTS',
            message: 'private SQL detail',
          },
        }),
        { status: 409 },
      ),
    ),
  )
  await expect(saveWeight(null, data.logs[0]!)).rejects.toMatchObject({
    code: 'WELLNESS_DATE_EXISTS',
  })
  expect(wellnessError(new WellnessApiError('WELLNESS_DATE_EXISTS'))).toContain(
    'sửa lần cân đã có',
  )
  expect(wellnessError(new Error('private network detail'))).not.toContain(
    'private',
  )
})
