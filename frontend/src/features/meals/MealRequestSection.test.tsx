import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T01:00:00Z'))
})
import type { FamilyProfile } from '../auth/auth-api'
import { MealRequestSection } from './MealRequestSection'
import type { MealRequest } from './meal-request-api'
import { familyDate } from './family-time'

vi.mock('./FinalMealSection', () => ({ FinalMealSection: () => null }))

const member: FamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
const parent: FamilyProfile = {
  ...member,
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Synthetic Parent',
  role: 'PARENT',
}
const optionId = '33333333-3333-4333-8333-333333333333'
const requestId = '44444444-4444-4444-8444-444444444444'
function meal(overrides: Partial<MealRequest> = {}): MealRequest {
  return {
    id: requestId,
    mealDate: familyDate(),
    mealType: 'DINNER',
    mode: 'OPTION_POLL',
    status: 'OPEN',
    deadlineAt: '2026-10-21T12:00:00Z',
    parentMessage: 'Please choose',
    createdBy: { id: parent.id, displayName: parent.displayName },
    options: [
      { id: optionId, label: 'Rice', sortOrder: 1 },
      {
        id: '55555555-5555-4555-8555-555555555555',
        label: 'Noodles',
        sortOrder: 2,
      },
    ],
    createdAt: '2026-10-21T07:00:00Z',
    updatedAt: '2026-10-21T07:00:00Z',
    timeZone: 'Asia/Ho_Chi_Minh',
    isOpen: true,
    responses: [
      {
        member: {
          id: member.id,
          displayName: member.displayName,
          avatarType: null,
          avatarValue: null,
        },
        state: 'NO_RESPONSE',
        option: null,
        customText: null,
        updatedAt: null,
      },
    ],
    ...overrides,
  }
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function fetchFor(initial: MealRequest[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/meals/requests/current')
      return json({ requests: initial })
    if (url.endsWith('/response') && init?.method === 'PUT')
      return json({ response: { id: 'saved' } })
    if (url === '/api/meals/requests' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      return json(
        {
          request: meal({
            mealDate: body.mealDate,
            mealType: body.mealType,
            mode: body.mode === 'SELF_SERVICE' ? null : body.mode,
            status: body.mode === 'SELF_SERVICE' ? 'SELF_SERVICE' : 'OPEN',
            deadlineAt: body.deadlineAt ?? null,
            options: [],
          }),
        },
        201,
      )
    }
    if (
      url === `/api/meals/requests/${requestId}` &&
      init?.method === 'PATCH'
    ) {
      const body = JSON.parse(init.body as string)
      return json({
        request: meal({
          status: body.status,
          mode: body.status === 'SELF_SERVICE' ? null : 'OPTION_POLL',
          deadlineAt: body.deadlineAt ?? null,
        }),
      })
    }
    throw new Error(`Unexpected ${url}`)
  })
}
afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.unstubAllGlobals()
})

describe('simplified dinner flow', () => {
  it('accepts free text without mode or option controls, saves and allows editing before cutoff', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([meal()])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={member} />)
    const field = await screen.findByLabelText('Bạn muốn ăn gì tối nay?')
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    await user.type(field, 'Con ăn cơm gà')
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    await screen.findByText('Con ăn cơm gà')
    await user.click(screen.getByRole('button', { name: 'Đổi lựa chọn' }))
    expect(
      (screen.getByLabelText('Bạn muốn ăn gì tối nay?') as HTMLTextAreaElement)
        .value,
    ).toBe('Con ăn cơm gà')
    await user.clear(screen.getByLabelText('Bạn muốn ăn gì tối nay?'))
    await user.type(
      screen.getByLabelText('Bạn muốn ăn gì tối nay?'),
      'Con ăn bún bò',
    )
    await user.click(screen.getByRole('button', { name: 'Cập nhật lựa chọn' }))
    await screen.findByText('Con ăn bún bò')
    expect(
      fetch.mock.calls.filter((c) => c[0].endsWith('/response')),
    ).toHaveLength(2)
  })
  it('reads legacy poll choice safely and edits it as free text', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      fetchFor([
        meal({
          responses: [
            {
              ...meal().responses[0],
              state: 'SELECTED_OPTION',
              option: { id: optionId, label: 'Rice' },
            },
          ],
        }),
      ]),
    )
    render(<MealRequestSection profile={member} />)
    await screen.findByText('Rice')
    await user.click(screen.getByRole('button', { name: 'Đổi lựa chọn' }))
    expect(
      (screen.getByLabelText('Bạn muốn ăn gì tối nay?') as HTMLTextAreaElement)
        .value,
    ).toBe('Rice')
    expect(screen.queryByRole('radio')).toBeNull()
  })
  it('retains explicit no-dinner server state after a text reply', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([meal()])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={member} />)
    await user.type(
      await screen.findByLabelText('Bạn muốn ăn gì tối nay?'),
      'Hôm nay con không ăn tối',
    )
    fetch.mockResolvedValueOnce(
      json({
        response: { id: 'saved', responseType: 'NOT_EATING', customText: null },
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    await screen.findByText('Không ăn')
    expect(screen.queryByLabelText('Bạn muốn ăn gì tối nay?')).toBeNull()
  })
  it('locks edits at the actual deadline even if loaded isOpen was true', async () => {
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
    vi.stubGlobal('fetch', fetchFor([meal()]))
    render(<MealRequestSection profile={member} />)
    await screen.findByText('Đã đóng phản hồi.')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đổi lựa chọn' })).toBeNull()
  })
  it('refreshes deadline lock on returning from a background tab', async () => {
    vi.stubGlobal('fetch', fetchFor([meal()]))
    render(<MealRequestSection profile={member} />)
    await screen.findByLabelText('Bạn muốn ăn gì tối nay?')
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
    fireEvent(window, new Event('focus'))
    await screen.findByText('Đã đóng phản hồi.')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('keeps self-service noninteractive', async () => {
    vi.stubGlobal(
      'fetch',
      fetchFor([
        meal({
          status: 'SELF_SERVICE',
          mode: null,
          deadlineAt: null,
          responses: [],
          options: [],
        }),
      ]),
    )
    render(<MealRequestSection profile={member} />)
    await screen.findByText('Không cần phản hồi.')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull()
  })
  it('shows safe response error and allows retry without losing text', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([meal()])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={member} />)
    await user.type(
      await screen.findByLabelText('Bạn muốn ăn gì tối nay?'),
      'Con ăn cơm gà',
    )
    fetch.mockRejectedValueOnce(new Error('private detail'))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    await screen.findByRole('alert')
    expect(screen.queryByText('private detail')).toBeNull()
    expect(
      (screen.getByLabelText('Bạn muốn ăn gì tối nay?') as HTMLTextAreaElement)
        .value,
    ).toBe('Con ăn cơm gà')
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    await screen.findByText('Con ăn cơm gà')
  })
  it('creates one simple parent question with message and editable 14:00 deadline', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Hôm nay mọi người muốn ăn gì?' }),
    ).toBeTruthy()
    expect(
      (screen.getByLabelText('Hạn trả lời') as HTMLInputElement).value,
    ).toBe('14:00')
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByLabelText(/Lựa chọn 1/)).toBeNull()
    await user.type(
      screen.getByLabelText('Lời nhắn cho cả nhà'),
      'Mẹ có cơm gà, bún bò hoặc phở, hai đứa nói mẹ biết nha',
    )
    await user.clear(screen.getByLabelText('Hạn trả lời'))
    fireEvent.change(screen.getByLabelText('Hạn trả lời'), {
      target: { value: '15:30' },
    })
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }))
    await screen.findByRole('button', { name: 'Chỉnh sửa' })
    const call = fetch.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({
      mode: 'OPEN_CHOICE',
      deadlineAt: '2026-10-21T08:30:00.000Z',
      parentMessage: 'Mẹ có cơm gà, bún bò hoặc phở, hai đứa nói mẹ biết nha',
    })
    expect(screen.queryByLabelText('Hạn trả lời')).toBeNull()
  })
  it('edits legacy poll message/deadline without replacing its mode/options/responses', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([meal()])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    expect(screen.queryByRole('combobox')).toBeNull()
    await user.type(
      screen.getByLabelText('Lời nhắn cho cả nhà'),
      ' thêm lời nhắn',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }))
    await screen.findByRole('button', { name: 'Chỉnh sửa' })
    const body = JSON.parse(
      fetch.mock.calls.find((c) => c[1]?.method === 'PATCH')![1]!
        .body as string,
    )
    expect(body).toMatchObject({ status: 'OPEN' })
    expect(body.mode).toBeUndefined()
    expect(body.options).toBeUndefined()
  })
  it('returns self-service to a question using the same request', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([
        meal({
          status: 'SELF_SERVICE',
          mode: null,
          deadlineAt: null,
          responses: [],
          options: [],
        }),
      ])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Đổi kế hoạch' }),
    )
    await user.click(screen.getByRole('button', { name: 'Hỏi cả nhà' }))
    await user.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }))
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          (c) =>
            c[0] === '/api/meals/requests/' + requestId &&
            c[1]?.method === 'PATCH',
        ),
      ).toBe(true),
    )
    expect(fetch.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false)
  })
  it('requires confirmation before self-service invalidates existing responses', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([
        meal({
          responses: [
            {
              ...meal().responses[0],
              state: 'CUSTOM',
              customText: 'Con ăn cơm gà',
            },
          ],
        }),
      ])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await screen.findByText('Con ăn cơm gà')
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    await user.click(screen.getByRole('button', { name: 'Chuyển sang tự túc' }))
    await user.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }))
    await screen.findByRole('alertdialog')
    expect(fetch.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(false)
    await user.click(
      screen.getByRole('button', { name: 'Đồng ý, lưu kế hoạch' }),
    )
    await waitFor(() =>
      expect(fetch.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(true),
    )
  })
  it('requires confirmation to cancel, then makes the slot available again', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([meal()])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Xóa kế hoạch' }),
    )
    expect(fetch.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(false)
    await user.click(
      screen.getByRole('button', { name: 'Đồng ý, xóa kế hoạch' }),
    )
    await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' })
  })
  it('recreation requires explicit confirmation and conflicts guide Mom to the existing plan', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([])
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    fetch.mockResolvedValueOnce(
      json({ error: { code: 'MEAL_RESPONSE_RESET_REQUIRED' } }, 409),
    )
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }))
    await screen.findByRole('alertdialog')
    fetch.mockResolvedValueOnce(json({ error: { code: 'MEAL_CONFLICT' } }, 409))
    await user.click(
      screen.getByRole('button', { name: 'Đồng ý, tạo lại kế hoạch' }),
    )
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Chỉnh sửa',
    )
  })
  it('does not expose lunch, cancelled or future plans/date planning', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      fetchFor([
        meal({ mealType: 'LUNCH' }),
        meal({ mealDate: '2099-01-01' }),
        meal({ status: 'CANCELLED' }),
      ]),
    )
    const { container } = render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    expect(
      container.querySelector('input[type=date],input[type=datetime-local]'),
    ).toBeNull()
    expect(screen.queryByText('Kế hoạch đã hủy')).toBeNull()
  })
  it('offers safe load retry', async () => {
    const user = userEvent.setup(),
      fetch = fetchFor([])
    fetch.mockRejectedValueOnce(new Error('private detail'))
    vi.stubGlobal('fetch', fetch)
    render(<MealRequestSection profile={parent} />)
    await user.click(await screen.findByRole('button', { name: 'Thử tải lại' }))
    await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' })
    expect(screen.queryByText('private detail')).toBeNull()
  })
})
