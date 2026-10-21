import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FinalMealSection } from './FinalMealSection'
import { MealRequestSection } from './MealRequestSection'
import { familyDate } from './family-time'
import type { FinalMeal } from './final-meal-api'

const parent = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Parent',
  role: 'PARENT' as const,
  avatarType: null,
  avatarValue: null,
}
const meal: FinalMeal = {
  id: parent.id,
  mealDate: '2099-05-01',
  mealType: 'DINNER',
  mealRequestId: null,
  finalizedByMemberId: parent.id,
  readyAt: null,
  readyMessage: null,
  createdAt: '2099-05-01T10:00:00Z',
  updatedAt: '2099-05-01T10:00:00Z',
  dishes: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Cơm gà rô ti',
      category: 'MAIN',
      sortOrder: 0,
    },
  ],
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function setup(initial: FinalMeal | null = null) {
  let saved = initial
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body as string)
      saved = _url.endsWith('/ready')
        ? {
            ...saved!,
            readyAt: saved?.readyAt ?? '2099-05-01T11:00:00Z',
            readyMessage: body.readyMessage,
          }
        : {
            ...meal,
            dishes: body.dishes.map((dish: object, index: number) => ({
              id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
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
describe('final meal family flow', () => {
  it('carries dish identities through rename, reorder, addition, and explicit removal without displaying IDs', async () => {
    const user = userEvent.setup()
    const soupId = '33333333-3333-4333-8333-333333333333'
    const fetchMock = setup({
      ...meal,
      dishes: [
        ...meal.dishes,
        { id: soupId, name: 'Canh cải', category: 'SOUP', sortOrder: 1 },
      ],
    })
    render(<FinalMealSection profile={parent} requests={[]} />)
    await user.click(
      await screen.findByRole('button', { name: 'Chỉnh sửa món' }),
    )
    await user.clear(screen.getByLabelText('Tên món 1'))
    await user.type(screen.getByLabelText('Tên món 1'), 'Cơm gà mới')
    await user.click(screen.getByRole('button', { name: 'Đưa món 2 lên' }))
    await user.click(screen.getByRole('button', { name: 'Thêm món' }))
    await user.type(screen.getByLabelText('Tên món 3'), 'Rau luộc')
    await user.click(screen.getByRole('button', { name: 'Lưu món sẽ nấu' }))
    await screen.findByRole('button', { name: 'Chỉnh sửa món' })
    const firstSave = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    )!
    expect(JSON.parse(firstSave[1]!.body as string).dishes).toEqual([
      { id: soupId, name: 'Canh cải', category: 'SOUP', sortOrder: 0 },
      {
        id: meal.dishes[0]!.id,
        name: 'Cơm gà mới',
        category: 'MAIN',
        sortOrder: 1,
      },
      { name: 'Rau luộc', category: 'MAIN', sortOrder: 2 },
    ])
    expect(screen.queryByText(soupId)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa món' }))
    await user.click(screen.getByRole('button', { name: 'Xóa món 1' }))
    await user.click(screen.getByRole('button', { name: 'Lưu món sẽ nấu' }))
    await screen.findByRole('button', { name: 'Chỉnh sửa món' })
    const saves = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === 'PUT',
    )
    expect(
      JSON.parse(saves[1]![1]!.body as string).dishes.map(
        (dish: { id?: string }) => dish.id,
      ),
    ).not.toContain(soupId)
    expect(JSON.parse(saves[1]![1]!.body as string).dishes[0].id).toBe(
      meal.dishes[0]!.id,
    )
  })
  it('keeps family responses visible alongside the actual meal', async () => {
    const request = {
      id: parent.id,
      mealDate: familyDate(),
      mealType: 'DINNER',
      mode: 'OPEN_CHOICE',
      status: 'OPEN',
      deadlineAt: '2099-05-01T12:00:00Z',
      parentMessage: null,
      createdBy: { id: parent.id, displayName: parent.displayName },
      options: [],
      createdAt: meal.createdAt,
      updatedAt: meal.updatedAt,
      timeZone: 'Asia/Ho_Chi_Minh',
      isOpen: true,
      responses: [
        {
          member: {
            id: '22222222-2222-4222-8222-222222222222',
            displayName: 'Synthetic Child',
            avatarType: null,
            avatarValue: null,
          },
          state: 'CUSTOM',
          option: null,
          customText: 'Món con muốn ăn',
          updatedAt: meal.updatedAt,
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        json(
          url.endsWith('/current')
            ? { requests: [request] }
            : { meal: { ...meal, mealDate: familyDate() } },
        ),
      ),
    )
    render(<MealRequestSection profile={parent} />)
    expect(await screen.findByText('Món con muốn ăn')).toBeTruthy()
    expect(await screen.findByText('Cơm gà rô ti')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeTruthy()
  })
  it('lets Mom add, remove, reorder, save collapsed, and restore dishes for editing', async () => {
    const user = userEvent.setup()
    const fetchMock = setup()
    render(<FinalMealSection profile={parent} requests={[]} />)
    await user.click(
      await screen.findByRole('button', { name: 'Thêm món sẽ nấu' }),
    )
    await user.type(screen.getByLabelText('Tên món 1'), 'Cơm gà rô ti')
    await user.click(screen.getByRole('button', { name: 'Thêm món' }))
    await user.type(screen.getByLabelText('Tên món 2'), 'Canh cải')
    await user.selectOptions(screen.getByLabelText('Nhóm món 2'), 'SOUP')
    await user.click(screen.getByRole('button', { name: 'Thêm món' }))
    await user.type(screen.getByLabelText('Tên món 3'), 'Món tạm')
    await user.click(screen.getByRole('button', { name: 'Xóa món 3' }))
    await user.click(screen.getByRole('button', { name: 'Đưa món 2 lên' }))
    expect((screen.getByLabelText('Tên món 1') as HTMLInputElement).value).toBe(
      'Canh cải',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu món sẽ nấu' }))
    await screen.findByRole('button', { name: 'Chỉnh sửa món' })
    expect(screen.queryByLabelText('Tên món 1')).toBeNull()
    const call = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    )!
    expect(JSON.parse(call[1]!.body as string).dishes).toEqual([
      { name: 'Canh cải', category: 'SOUP', sortOrder: 0 },
      { name: 'Cơm gà rô ti', category: 'MAIN', sortOrder: 1 },
    ])
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa món' }))
    expect((screen.getByLabelText('Tên món 1') as HTMLInputElement).value).toBe(
      'Canh cải',
    )
  })
  it('marks ready with an optional message and edits the message', async () => {
    const user = userEvent.setup()
    setup(meal)
    render(<FinalMealSection profile={parent} requests={[]} />)
    await user.type(
      await screen.findByLabelText('Lời nhắn khi bữa ăn sẵn sàng'),
      'Canh ở trong nồi nhé',
    )
    await user.click(screen.getByRole('button', { name: 'Bữa ăn đã sẵn sàng' }))
    expect(await screen.findByText('Bữa tối đã sẵn sàng ✓')).toBeTruthy()
    expect(screen.getByText('Canh ở trong nồi nhé')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Sửa lời nhắn bữa ăn' }),
    )
    await user.clear(screen.getByLabelText('Lời nhắn khi bữa ăn sẵn sàng'))
    await user.type(
      screen.getByLabelText('Lời nhắn khi bữa ăn sẵn sàng'),
      'Cơm vẫn còn nóng',
    )
    await user.click(
      screen.getByRole('button', { name: 'Lưu lời nhắn bữa ăn' }),
    )
    expect(await screen.findByText('Cơm vẫn còn nóng')).toBeTruthy()
  })
  it.each([null, '2099-05-01T11:00:00Z'])(
    'shows members read-only preparing/ready state %s',
    async (readyAt) => {
      setup({
        ...meal,
        readyAt,
        readyMessage: readyAt ? 'Cả nhà ăn nhé' : null,
      })
      render(
        <FinalMealSection
          profile={{ ...parent, role: 'ADMIN' }}
          requests={[]}
        />,
      )
      await screen.findByText('Cơm gà rô ti')
      expect(
        screen.getByText(
          readyAt ? 'Bữa tối đã sẵn sàng ✓' : 'Mẹ đang chuẩn bị bữa này',
        ),
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Chỉnh sửa món' })).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Bữa ăn đã sẵn sàng' }),
      ).toBeNull()
    },
  )
  it('retries a safe load error and handles empty state', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('private detail'))
        .mockResolvedValue(json({ meal: null })),
    )
    render(<FinalMealSection profile={parent} requests={[]} />)
    expect(screen.getByRole('status').textContent).toContain('Đang tải món')
    await user.click(
      await screen.findByRole('button', { name: 'Thử tải lại món' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Thêm món sẽ nấu' }),
    ).toBeTruthy()
    expect(screen.queryByText('private detail')).toBeNull()
  })
  it('keeps failed saves editable and handles self-service conflicts safely', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ meal: null }))
        .mockResolvedValue(
          json(
            {
              error: {
                code: 'FINAL_MEAL_SELF_SERVICE',
                message: 'private detail',
              },
            },
            409,
          ),
        ),
    )
    render(<FinalMealSection profile={parent} requests={[]} />)
    await user.click(
      await screen.findByRole('button', { name: 'Thêm món sẽ nấu' }),
    )
    await user.type(screen.getByLabelText('Tên món 1'), 'Rau luộc')
    await user.click(screen.getByRole('button', { name: 'Lưu món sẽ nấu' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Bữa này đang tự túc. Hãy chọn “Chỉnh sửa” ở yêu cầu bữa ăn trước khi lưu món.',
    )
    expect(screen.getByLabelText('Tên món 1')).toBeTruthy()
  })
  it('ignores a stale slot response after switching dates', async () => {
    let resolveOld!: (value: Response) => void
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveOld = resolve
            }),
        )
        .mockResolvedValue(json({ meal: null })),
    )
    render(<FinalMealSection profile={parent} requests={[]} />)
    fireEvent.change(screen.getByLabelText('Ngày xem món'), {
      target: { value: '2099-05-02' },
    })
    await screen.findByRole('button', { name: 'Thêm món sẽ nấu' })
    resolveOld(json({ meal }))
    await waitFor(() => expect(screen.queryByText('Cơm gà rô ti')).toBeNull())
  })
  it('keeps ready failure retryable without exposing details', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ meal }))
        .mockRejectedValue(new Error('private detail')),
    )
    render(<FinalMealSection profile={parent} requests={[]} />)
    await user.click(
      await screen.findByRole('button', { name: 'Bữa ăn đã sẵn sàng' }),
    )
    expect(
      await screen.findByText('Chưa thể báo bữa ăn sẵn sàng. Mẹ thử lại nhé.'),
    ).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Bữa ăn đã sẵn sàng',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
    expect(screen.queryByText('private detail')).toBeNull()
  })
})
