import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCalendar,
  saveCalendarEvent,
  deleteCalendarEvent,
  saveCalendarException,
  calendarError,
  CalendarApiError,
} from './calendar-api'
import { weekRange, shiftDay, calendarTime } from './calendar-time'
afterEach(() => vi.unstubAllGlobals())
describe('calendar API and family time boundary', () => {
  it('uses session credentials and does not send client ownership fields', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return new Response(null, { status: 204 })
      }),
    )
    await saveCalendarEvent(
      {
        title: 'Synthetic calendar',
        category: 'OTHER',
        startsAt: '2099-05-04T02:00:00Z',
        endsAt: '2099-05-04T03:00:00Z',
        note: null,
        weekdays: null,
        recurrenceUntil: null,
      },
      null,
    )
    await deleteCalendarEvent('synthetic-event')
    await saveCalendarException('synthetic-event', '2099-05-04', {
      cancelled: true,
    })
    expect(calls.map((c) => c.init.method)).toEqual(['POST', 'DELETE', 'PUT'])
    expect(calls.every((c) => c.init.credentials === 'same-origin')).toBe(true)
    expect(String(calls[0]!.init.body)).not.toMatch(/owner|actor/)
  })
  it('reads only safe profile fields and forwards range/filter/cancellation', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            calendar: {
              from: '2099-05-04',
              to: '2099-05-10',
              timeZone: 'Asia/Ho_Chi_Minh',
              members: [
                {
                  id: 'self',
                  displayName: 'Synthetic',
                  avatarType: null,
                  avatarValue: null,
                  pin_hash: 'private',
                },
              ],
              occurrences: [],
            },
          }),
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const result = await fetchCalendar(
      '2099-05-04',
      '2099-05-10',
      'self',
      signal,
    )
    expect(result.members).toEqual([
      {
        id: 'self',
        displayName: 'Synthetic',
        avatarType: null,
        avatarValue: null,
      },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calendar?from=2099-05-04&to=2099-05-10&calendarType=FAMILY&memberId=self',
      expect.objectContaining({ signal }),
    )
  })
  it.each([
    {},
    {
      calendar: {
        from: '2099-05-04',
        to: '2099-05-10',
        timeZone: 'Asia/Ho_Chi_Minh',
        members: [null],
        occurrences: [],
      },
    },
    {
      calendar: {
        from: '2099-05-04',
        to: '2099-05-10',
        timeZone: 'Asia/Ho_Chi_Minh',
        members: [],
        occurrences: [null],
      },
    },
  ])('rejects malformed calendar responses', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body))),
    )
    await expect(
      fetchCalendar(
        '2099-05-04',
        '2099-05-10',
        null,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(CalendarApiError)
  })
  it.each([
    ['CALENDAR_FORBIDDEN', 'Bạn chỉ có thể thay đổi lịch của mình.'],
    [
      'CALENDAR_EXCEPTIONS_EXIST',
      'Lịch này đã có thay đổi riêng. Hãy chỉnh từng lần để giữ nguyên các buổi đã đổi nhé.',
    ],
    [
      'UNAUTHENTICATED',
      'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.',
    ],
  ])('shows safe actionable Vietnamese for %s', async (code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code, message: 'private storage detail' },
            }),
            { status: 403 },
          ),
      ),
    )
    let caught: unknown
    try {
      await deleteCalendarEvent('synthetic')
    } catch (error) {
      caught = error
    }
    expect(calendarError(caught)).toBe(message)
  })
  it('handles non-JSON and network errors without displaying details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('private proxy detail', { status: 503 })),
    )
    await expect(deleteCalendarEvent('synthetic')).rejects.toMatchObject({
      code: 'CALENDAR_UNAVAILABLE',
    })
    expect(calendarError(new Error('private network detail'))).toBe(
      'Chưa thể cập nhật lịch. Bạn thử lại nhé.',
    )
  })
  it.each([
    ['2099-05-04', { from: '2099-05-04', to: '2099-05-10' }],
    ['2099-05-10', { from: '2099-05-04', to: '2099-05-10' }],
  ])('uses Monday-Sunday week for %s', (day, range) =>
    expect(weekRange(day)).toEqual(range),
  )
  it('crosses year boundaries and formats family time without host timezone assumptions', () => {
    expect(shiftDay('2099-12-31', 1)).toBe('2100-01-01')
    expect(calendarTime('2099-05-04T02:30:00Z')).toBe('09:30')
  })
})
