import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MealDishRatings } from './MealDishRatings'
import { FinalMealSection } from './FinalMealSection'

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const dishes = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Thịt kho',
    category: 'MAIN' as const,
    sortOrder: 0,
    ratings: [],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Canh cải',
    category: 'SOUP' as const,
    sortOrder: 1,
    ratings: [],
  },
]
const rating = {
  memberId: profile.id,
  displayName: profile.displayName,
  rating: 5,
  comment: 'Ngon lắm',
  createdAt: '2099-01-01T00:00:00Z',
  updatedAt: '2099-01-01T00:00:00Z',
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status })
}
function setup(ratings = false) {
  const state = {
    mealId: profile.id,
    ready: true,
    dishes: dishes.map((dish) => ({
      ...dish,
      ratings: ratings ? [rating] : [],
    })),
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const input = JSON.parse(init.body as string)
      const saved = { ...rating, ...input }
      state.dishes.find((dish) => url.includes(dish.id))!.ratings = [saved]
      return json({ rating: saved })
    }
    return json({ feedback: state })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
function view(role: 'MEMBER' | 'PARENT' = 'MEMBER') {
  return render(
    <MealDishRatings
      mealId={profile.id}
      profile={{ ...profile, role }}
      initialDishes={dishes}
    />,
  )
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('per-dish family feedback', () => {
  it('starts collapsed, saves one dish, restores editing, and persists on refresh', async () => {
    const user = userEvent.setup()
    const fetchMock = setup()
    const first = view()
    const card = await screen.findByRole('group', { name: 'Thịt kho' })
    await user.click(
      await within(card).findByRole('button', { name: 'Đánh giá món' }),
    )
    await user.click(within(card).getByRole('radio', { name: '5 sao' }))
    await user.type(
      within(card).getByLabelText('Nhận xét món này (không bắt buộc)'),
      'Ngon lắm',
    )
    await user.click(within(card).getByRole('button', { name: 'Lưu đánh giá' }))
    expect(await within(card).findByText('Ngon lắm')).toBeTruthy()
    expect(within(card).queryByRole('textbox')).toBeNull()
    expect(
      screen.getAllByRole('button', { name: 'Đánh giá món' }),
    ).toHaveLength(1)
    const write = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    )!
    expect(write[0]).toBe(`/api/meals/dishes/${dishes[0]!.id}/rating`)
    expect(JSON.parse(write[1]!.body as string)).toEqual({
      rating: 5,
      comment: 'Ngon lắm',
    })
    await user.click(
      within(card).getByRole('button', { name: 'Chỉnh sửa đánh giá' }),
    )
    expect(
      (within(card).getByRole('radio', { name: '5 sao' }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(
      (within(card).getByRole('textbox') as HTMLTextAreaElement).value,
    ).toBe('Ngon lắm')
    await user.click(within(card).getByRole('radio', { name: '4 sao' }))
    await user.click(within(card).getByRole('button', { name: 'Lưu đánh giá' }))
    await within(card).findByRole('button', { name: 'Chỉnh sửa đánh giá' })
    first.unmount()
    view()
    expect(await screen.findByText('Ngon lắm')).toBeTruthy()
  })
  it('rates another dish independently with an optional blank comment using keyboard', async () => {
    const user = userEvent.setup()
    setup()
    view()
    const card = await screen.findByRole('group', { name: 'Canh cải' })
    await user.click(
      await within(card).findByRole('button', { name: 'Đánh giá món' }),
    )
    const radio = within(card).getByRole('radio', { name: '3 sao' })
    radio.focus()
    await user.keyboard(' ')
    await user.click(within(card).getByRole('button', { name: 'Lưu đánh giá' }))
    expect(
      await within(card).findByRole('button', { name: 'Chỉnh sửa đánh giá' }),
    ).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Đánh giá món' }),
    ).toHaveLength(1)
  })
  it('shows parent feedback grouped by dish with no rating controls', async () => {
    setup(true)
    view('PARENT')
    const card = await screen.findByRole('group', { name: 'Thịt kho' })
    expect(await within(card).findByText('Synthetic Member')).toBeTruthy()
    expect(within(card).getByText('Ngon lắm')).toBeTruthy()
    expect(within(card).getByText('5 · 1 đánh giá')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đánh giá món' })).toBeNull()
  })
  it('shows loading and safe retry after network failure', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('private'))
        .mockResolvedValue(
          json({ feedback: { mealId: profile.id, ready: true, dishes } }),
        ),
    )
    view()
    expect(screen.getByRole('status').textContent).toContain(
      'Đang tải đánh giá',
    )
    await user.click(
      await screen.findByRole('button', { name: 'Thử tải lại đánh giá' }),
    )
    expect(
      await screen.findAllByRole('button', { name: 'Đánh giá món' }),
    ).toHaveLength(2)
    expect(screen.queryByText('private')).toBeNull()
  })
  it('keeps failed save editable, does not expose server details, and retries', async () => {
    const user = userEvent.setup()
    const fetchMock = setup()
    view()
    const card = await screen.findByRole('group', { name: 'Thịt kho' })
    await user.click(
      await within(card).findByRole('button', { name: 'Đánh giá món' }),
    )
    await user.click(within(card).getByRole('radio', { name: '4 sao' }))
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'INTERNAL_ERROR', message: 'private' } }, 503),
    )
    await user.click(within(card).getByRole('button', { name: 'Lưu đánh giá' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Chưa lưu được đánh giá. Bạn thử lại nhé.',
    )
    expect(within(card).getByRole('textbox')).toBeTruthy()
    await user.click(within(card).getByRole('button', { name: 'Lưu đánh giá' }))
    expect(
      await within(card).findByRole('button', { name: 'Chỉnh sửa đánh giá' }),
    ).toBeTruthy()
  })
  it('does not show controls before ready, even with returned feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ feedback: { mealId: profile.id, ready: false, dishes } }),
        ),
    )
    view()
    await screen.findByText('Bữa này chưa sẵn sàng để đánh giá.')
    expect(screen.queryByRole('button', { name: 'Đánh giá món' })).toBeNull()
  })
  it('rejects malformed network feedback safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({
            feedback: {
              mealId: profile.id,
              ready: true,
              dishes: [{ ...dishes[0], ratings: [{ ...rating, rating: 6 }] }],
            },
          }),
        ),
    )
    view()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đánh giá món' })).toBeNull()
  })
  it('does not fetch or render rating controls for a preparing final meal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({
          meal: {
            id: profile.id,
            mealDate: '2099-01-01',
            mealType: 'DINNER',
            mealRequestId: null,
            finalizedByMemberId: profile.id,
            readyAt: null,
            readyMessage: null,
            createdAt: rating.createdAt,
            updatedAt: rating.updatedAt,
            dishes,
          },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<FinalMealSection profile={profile} requests={[]} />)
    await screen.findByText('Mẹ đang chuẩn bị bữa này')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Đánh giá món' })).toBeNull()
  })
  it('limits comments and requires a star before saving', async () => {
    const user = userEvent.setup()
    setup()
    view()
    const card = await screen.findByRole('group', { name: 'Thịt kho' })
    await user.click(
      await within(card).findByRole('button', { name: 'Đánh giá món' }),
    )
    expect(
      (
        within(card).getByRole('button', {
          name: 'Lưu đánh giá',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(within(card).getByRole('textbox')).toHaveProperty('maxLength', 300)
    fireEvent.change(within(card).getByRole('textbox'), {
      target: { value: 'Hơi mặn' },
    })
    await user.click(within(card).getByRole('button', { name: 'Để sau' }))
    expect(within(card).queryByRole('textbox')).toBeNull()
  })
})
