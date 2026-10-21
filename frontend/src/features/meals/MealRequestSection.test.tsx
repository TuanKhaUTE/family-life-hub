import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FamilyProfile } from '../auth/auth-api'
import { MealRequestSection } from './MealRequestSection'
import type { MealRequest } from './meal-request-api'

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
    mealDate: '2026-10-21',
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
  cleanup()
  vi.unstubAllGlobals()
})

describe('member lunch and dinner flow', () => {
  it('shows no response distinctly and submits an option', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([meal()])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={member} />)
    expect(await screen.findByRole('radio', { name: 'Rice' })).toBeTruthy()
    expect(screen.getByText('Chưa trả lời')).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: 'Rice' }))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    expect(await screen.findByText('Đã lưu lựa chọn')).toBeTruthy()
    expect(screen.getByText('Rice')).toBeTruthy()
    const call = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/response'),
    )!
    expect(JSON.parse(call[1]?.body as string)).toEqual({
      responseType: 'SELECTED_OPTION',
      optionId,
    })
  })
  it('restores a persisted response collapsed and reopens it highlighted', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      fetchFor([
        meal({
          responses: [
            {
              ...meal().responses[0]!,
              state: 'SELECTED_OPTION',
              option: { id: optionId, label: 'Rice' },
              updatedAt: '2026-10-21T08:00:00Z',
            },
          ],
        }),
      ]),
    )
    render(<MealRequestSection profile={member} />)
    expect(await screen.findByText('Đã lưu lựa chọn')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Rice' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Đổi lựa chọn' }))
    expect(
      (screen.getByRole('radio', { name: 'Rice' }) as HTMLInputElement).checked,
    ).toBe(true)
  })
  it('supports custom open choice and Not eating', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([meal({ mode: 'OPEN_CHOICE', options: [] })])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={member} />)
    await user.click(await screen.findByRole('radio', { name: 'Món tự chọn' }))
    await user.type(screen.getByLabelText('Món bạn muốn ăn'), '  Soup  ')
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    expect(await screen.findByText('Soup')).toBeTruthy()
  })

  it('saves Not eating as an explicit response', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([meal()])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={member} />)
    await user.click(await screen.findByRole('radio', { name: 'Không ăn' }))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    expect(await screen.findByText('Đã lưu lựa chọn')).toBeTruthy()
    expect(screen.getByText('Không ăn')).toBeTruthy()
  })
  it('shows self-service and closed states without editing', async () => {
    vi.stubGlobal(
      'fetch',
      fetchFor([
        meal({
          id: '66666666-6666-4666-8666-666666666666',
          status: 'SELF_SERVICE',
          mode: null,
          deadlineAt: null,
          options: [],
          responses: [],
        }),
        meal({ status: 'CLOSED', isOpen: false }),
      ]),
    )
    render(<MealRequestSection profile={member} />)
    expect(await screen.findByText('Không cần phản hồi.')).toBeTruthy()
    expect(screen.getByText('Đã đóng phản hồi.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đổi lựa chọn' })).toBeNull()
  })
  it('shows a safe save error', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([meal()])
    fetchMock
      .mockImplementationOnce(async () => json({ requests: [meal()] }))
      .mockRejectedValueOnce(new Error('private detail'))
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={member} />)
    await user.click(await screen.findByRole('radio', { name: 'Rice' }))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))
    expect(
      await screen.findByText(
        'Chưa thể lưu lựa chọn của bạn. Vui lòng thử lại.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('private detail')).toBeNull()
  })
})

describe('parent lunch and dinner flow', () => {
  it('changes self service to open choice through the existing request', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([
      meal({
        status: 'SELF_SERVICE',
        mode: null,
        deadlineAt: null,
        options: [],
        responses: [],
      }),
    ])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)

    await user.click(await screen.findByRole('button', { name: 'Đổi kế hoạch' }))
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'OPEN_CHOICE',
    )
    await user.click(screen.getByRole('button', { name: 'Cập nhật kế hoạch' }))

    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === `/api/meals/requests/${requestId}` && init?.method === 'PATCH',
    )!
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      status: 'OPEN',
      mode: 'OPEN_CHOICE',
      options: [],
    })
  })

  it('changes self service to an option poll through the existing request', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([
      meal({
        status: 'SELF_SERVICE',
        mode: null,
        deadlineAt: null,
        options: [],
        responses: [],
      }),
    ])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)

    await user.click(await screen.findByRole('button', { name: 'Đổi kế hoạch' }))
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'OPTION_POLL',
    )
    const inputs = screen.getAllByLabelText(/Lựa chọn \d/)
    await user.type(inputs[0]!, 'Cơm')
    await user.type(inputs[1]!, 'Bún')
    await user.click(screen.getByRole('button', { name: 'Cập nhật kế hoạch' }))

    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === `/api/meals/requests/${requestId}` && init?.method === 'PATCH',
    )!
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      status: 'OPEN',
      mode: 'OPTION_POLL',
      options: ['Cơm', 'Bún'],
    })
  })

  it('guides Mom to the existing plan when a meal slot conflicts', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([])
    fetchMock.mockImplementationOnce(async () => json({ requests: [] }))
    fetchMock.mockImplementationOnce(async () =>
      json({ error: { code: 'MEAL_CONFLICT', message: 'private detail' } }, 409),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)

    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }))

    expect(
      await screen.findByText(
        'Bữa ăn này đã có kế hoạch. Hãy chọn “Đổi kế hoạch” trong thẻ hiện có.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('private detail')).toBeNull()
  })

  it('creates a self-service meal without a response form', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'SELF_SERVICE',
    )
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận tự túc' }),
    )
    expect(
      await screen.findByText('Mọi người tự sắp xếp bữa ăn này nhé.'),
    ).toBeTruthy()
    const call = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/meals/requests' && init?.method === 'POST',
    )!
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      mode: 'SELF_SERVICE',
      mealType: 'LUNCH',
    })
  })
  it('offers deadline presets and creates a 2-option poll', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'OPTION_POLL',
    )
    const inputs = screen.getAllByLabelText(/Lựa chọn \d/)
    await user.type(inputs[0]!, 'Rice')
    await user.type(inputs[1]!, 'Noodles')
    await user.click(screen.getByRole('button', { name: 'Sau 3 giờ' }))
    await user.click(screen.getByRole('button', { name: 'Tạo bình chọn' }))
    const call = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/meals/requests' && init?.method === 'POST',
    )!
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      mode: 'OPTION_POLL',
      options: ['Rice', 'Noodles'],
    })
  })

  it('creates an open-choice request', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    await user.type(screen.getByLabelText('Lời nhắn cho cả nhà'), 'Ideas?')
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }))
    const call = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/meals/requests' && init?.method === 'POST',
    )!
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      mode: 'OPEN_CHOICE',
      parentMessage: 'Ideas?',
    })
  })

  it('adds and removes optional poll inputs while keeping the minimum two', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', fetchFor([]))
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Lên kế hoạch bữa ăn' }),
    )
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'OPTION_POLL',
    )
    expect(
      (screen.getByRole('button', { name: 'Tạo bình chọn' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Thêm lựa chọn' }))
    expect(screen.getAllByLabelText(/Lựa chọn \d/)).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Xóa lựa chọn 3' }))
    expect(screen.getAllByLabelText(/Lựa chọn \d/)).toHaveLength(2)
  })
  it('shows each family response status and parent controls', async () => {
    vi.stubGlobal(
      'fetch',
      fetchFor([
        meal({
          responses: [
            meal().responses[0]!,
            {
              member: {
                id: '77777777-7777-4777-8777-777777777777',
                displayName: 'Other Member',
                avatarType: null,
                avatarValue: null,
              },
              state: 'NOT_EATING',
              option: null,
              customText: null,
              updatedAt: '2026-10-21T08:00:00Z',
            },
          ],
        }),
      ]),
    )
    render(<MealRequestSection profile={parent} />)
    expect(await screen.findByText('Chưa trả lời')).toBeTruthy()
    expect(screen.getByText('Không ăn')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đóng phản hồi' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lưu lựa chọn' })).toBeNull()
  })
  it('switches an open request to self service', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([meal()])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Chuyển sang tự túc' }),
    )
    expect(
      await screen.findByText('Mọi người tự sắp xếp bữa ăn này nhé.'),
    ).toBeTruthy()
  })

  it('edits an open request deadline and message', async () => {
    const user = userEvent.setup()
    const fetchMock = fetchFor([meal()])
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)
    await user.click(
      await screen.findByRole('button', { name: 'Chỉnh sửa yêu cầu' }),
    )
    const note = screen.getByLabelText('Lời nhắn cho cả nhà')
    await user.clear(note)
    await user.type(note, 'Updated note')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === `/api/meals/requests/${requestId}` && init?.method === 'PATCH',
    )!
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      status: 'OPEN',
      parentMessage: 'Updated note',
    })
  })
  it('shows a retryable safe load error', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('private'))
      .mockResolvedValueOnce(json({ requests: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MealRequestSection profile={parent} />)
    expect(
      await screen.findByText('Hiện chưa thể tải kế hoạch bữa trưa và bữa tối.'),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(
      await screen.findByText('Chưa có kế hoạch bữa trưa hoặc bữa tối.'),
    ).toBeTruthy()
  })
})
