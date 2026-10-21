import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FinalMealSection } from './FinalMealSection'
import { familyDate } from './family-time'
import type { MealRequest } from './meal-request-api'
const id = '11111111-1111-4111-8111-111111111111'
const dishId = '22222222-2222-4222-8222-222222222222'
const parent = {
  id,
  displayName: 'Synthetic Parent',
  role: 'PARENT' as const,
  avatarType: null,
  avatarValue: null,
}
const meal = {
  id,
  mealDate: familyDate(),
  mealType: 'DINNER',
  mealRequestId: id,
  finalizedByMemberId: id,
  readyAt: null as string | null,
  readyMessage: null,
  createdAt: '2099-05-01T10:00:00Z',
  updatedAt: '2099-05-01T10:00:00Z',
  dishes: [
    { id: dishId, name: 'Cơm gà rô ti', category: 'MAIN', sortOrder: 0 },
  ],
}
const request = {
  id,
  mealDate: familyDate(),
  mealType: 'DINNER',
  status: 'OPEN',
  candidates: [
    { name: 'Cơm gà rô ti', chosenBy: ['Synthetic Child', 'Synthetic Other'] },
    { name: 'Bún bò', chosenBy: ['Synthetic Other'] },
  ],
} as MealRequest
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status })
}
function setup(initial: typeof meal | null = null) {
  let saved = initial
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/ratings'))
      return json({
        feedback: {
          mealId: id,
          ready: true,
          dishes: saved!.dishes.map((dish) => ({ ...dish, ratings: [] })),
        },
      })
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body as string)
      saved = url.endsWith('/ready')
        ? {
            ...saved!,
            readyAt: '2099-05-01T12:00:00Z',
            readyMessage: body.readyMessage,
          }
        : {
            ...meal,
            dishes: body.dishes.map((dish: object, index: number) => ({
              id: index === 0 ? dishId : '33333333-3333-4333-8333-333333333333',
              ...dish,
            })),
          }
    }
    return json({ meal: saved })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('daily dinner finalization', () => {
  it('shows unique response candidates and secondary extras, without lunch/date/category planning', async () => {
    setup()
    render(<FinalMealSection profile={parent} requests={[request]} />)
    expect(
      await screen.findByRole('checkbox', { name: /Cơm gà rô ti/ }),
    ).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByText('Synthetic Child, Synthetic Other')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByLabelText('Ngày xem món')).toBeNull()
    expect(screen.queryByText('Bữa trưa')).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Bữa tối đã chốt' }),
    ).toBeTruthy()
  })
  it('saves selected candidates plus a manual extra, collapses, and restores IDs before ready', async () => {
    const user = userEvent.setup()
    const fetchMock = setup()
    render(<FinalMealSection profile={parent} requests={[request]} />)
    await user.click(
      await screen.findByRole('checkbox', { name: /Cơm gà rô ti/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Thêm món khác' }))
    await user.type(screen.getByLabelText('Món khác 1'), 'Canh cải')
    await user.click(screen.getByRole('button', { name: 'Lưu bữa tối' }))
    await user.click(
      await screen.findByRole('button', { name: 'Chỉnh sửa món' }),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu bữa tối' }))
    await screen.findByRole('button', { name: 'Chỉnh sửa món' })
    const saves = fetchMock.mock.calls.filter(
      ([url, init]) => init?.method === 'PUT' && !url.endsWith('/ready'),
    )
    expect(
      JSON.parse(saves[0]![1]!.body as string).dishes.map(
        (dish: { name: string }) => dish.name,
      ),
    ).toEqual(['Cơm gà rô ti', 'Canh cải'])
    expect(JSON.parse(saves[1]![1]!.body as string).dishes[0].id).toBe(dishId)
  })
  it('locks composition after ready but keeps editable message', async () => {
    const user = userEvent.setup()
    setup(meal)
    render(<FinalMealSection profile={parent} requests={[request]} />)
    await user.click(
      await screen.findByRole('button', { name: 'Bữa ăn đã sẵn sàng' }),
    )
    expect(await screen.findByText('Bữa tối đã sẵn sàng ✓')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa món' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Sửa lời nhắn bữa ăn' }),
    )
    await user.type(
      screen.getByLabelText('Lời nhắn khi bữa ăn sẵn sàng'),
      'Canh ở trong nồi nhé',
    )
    await user.click(
      screen.getByRole('button', { name: 'Lưu lời nhắn bữa ăn' }),
    )
    expect(await screen.findByText('Canh ở trong nồi nhé')).toBeTruthy()
  })
  it.each(['ADMIN', 'MEMBER', 'PARENT'] as const)(
    'opens separate focused feedback for %s, closes with Escape and restores focus',
    async (role) => {
      const user = userEvent.setup()
      const fetchMock = setup({ ...meal, readyAt: '2099-05-01T12:00:00Z' })
      render(<FinalMealSection profile={{ ...parent, role }} requests={[]} />)
      const button = await screen.findByRole('button', {
        name: role === 'PARENT' ? 'Xem góp ý bữa ăn' : 'Đánh giá bữa tối',
      })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith('/ratings')),
      ).toBe(false)
      await user.click(button)
      const dialog = screen.getByRole('dialog')
      expect(await within(dialog).findByText('Cơm gà rô ti')).toBeTruthy()
      if (role === 'PARENT')
        expect(
          within(dialog).queryByRole('button', { name: 'Đánh giá món' }),
        ).toBeNull()
      else
        expect(
          await within(dialog).findByRole('button', { name: 'Đánh giá món' }),
        ).toBeTruthy()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(button)
    },
  )
  it('blocks finalization for self-service and handles a safe load retry', async () => {
    const user = userEvent.setup()
    const fetchMock = setup()
    fetchMock.mockRejectedValueOnce(new Error('private'))
    render(
      <FinalMealSection
        profile={parent}
        requests={[{ ...request, status: 'SELF_SERVICE' }]}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: 'Thử tải lại món' }),
    )
    expect(await screen.findByText(/Bữa này đang tự túc/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lưu bữa tối' })).toBeNull()
    expect(screen.queryByText('private')).toBeNull()
  })
  it('keeps failed finalization editable with safe errors', async () => {
    const user = userEvent.setup()
    const fetchMock = setup()
    render(<FinalMealSection profile={parent} requests={[request]} />)
    await user.click(
      await screen.findByRole('checkbox', { name: /Cơm gà rô ti/ }),
    )
    fetchMock.mockRejectedValueOnce(new Error('private'))
    await user.click(screen.getByRole('button', { name: 'Lưu bữa tối' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Cơm gà rô ti/ })).toBeTruthy()
  })
})
