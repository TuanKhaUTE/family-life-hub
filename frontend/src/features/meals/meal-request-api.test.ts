import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMealRequest,
  fetchCurrentMealRequests,
  MealClosedApiError,
  saveMealResponse,
  updateMealRequest,
} from './meal-request-api'

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  mealDate: '2026-10-21',
  mealType: 'LUNCH',
  mode: 'OPEN_CHOICE',
  status: 'OPEN',
  deadlineAt: '2026-10-21T12:00:00Z',
  parentMessage: null,
  createdBy: {
    id: '22222222-2222-4222-8222-222222222222',
    displayName: 'Synthetic Parent',
  },
  options: [],
  createdAt: '2026-10-21T07:00:00Z',
  updatedAt: '2026-10-21T07:00:00Z',
  timeZone: 'Asia/Ho_Chi_Minh',
  isOpen: true,
  responses: [],
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
afterEach(() => vi.unstubAllGlobals())
describe('meal request API', () => {
  it('loads validated current requests with credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ requests: [item] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchCurrentMealRequests()).resolves.toEqual([item])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meals/requests/current',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
  it('creates and updates requests using JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => response({ request: item }))
    vi.stubGlobal('fetch', fetchMock)
    await createMealRequest({
      mealDate: '2026-10-21',
      mealType: 'LUNCH',
      mode: 'SELF_SERVICE',
    })
    await updateMealRequest(item.id, { status: 'CLOSED' })
    expect(
      fetchMock.mock.calls.map(([url, init]) => [url, init.method]),
    ).toEqual([
      ['/api/meals/requests', 'POST'],
      [`/api/meals/requests/${item.id}`, 'PATCH'],
    ])
  })
  it('submits a member response without a member id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ response: { id: 'x' } }))
    vi.stubGlobal('fetch', fetchMock)
    await saveMealResponse(item.id, { responseType: 'NOT_EATING' })
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      responseType: 'NOT_EATING',
    })
  })
  it('maps a closed conflict and hides other server/network details', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ error: { code: 'MEAL_CLOSED', message: 'private' } }, 409),
        ),
    )
    await expect(
      saveMealResponse(item.id, { responseType: 'NOT_EATING' }),
    ).rejects.toBeInstanceOf(MealClosedApiError)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('private network')),
    )
    await expect(fetchCurrentMealRequests()).rejects.toThrow(
      'temporarily unavailable',
    )
  })
})
