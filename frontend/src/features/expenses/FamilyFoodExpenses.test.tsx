import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { FamilyFoodExpenses } from './FamilyFoodExpenses'
import { MealFoodCost } from './MealFoodCost'
import { familyDate } from '../meals/family-time'
import { expenseDate } from './expense-display'
const id = '11111111-1111-4111-8111-111111111111'
const today = familyDate(),
  month = today.slice(0, 7),
  daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate(),
  priorDate = new Date(month + '-01T12:00:00Z')
priorDate.setUTCMonth(priorDate.getUTCMonth() - 1)
const expense = {
  id,
  mealDate: today,
  mealType: 'DINNER',
  category: 'DINNER',
  note: null,
  items: [
    { name: 'Synthetic dinner', amount: '100000' },
    { name: 'Soup', amount: '70000' },
  ],
  total: '170000',
}
const view = {
  month,
  currency: 'VND',
  page: 1,
  totalCount: 1,
  hasMore: false,
  expenses: [expense],
  summary: {
    currentTotal: '170000',
    previousTotal: '100000',
    previousMonth: priorDate.toISOString().slice(0, 7),
    differenceAmount: '70000',
    percentageChange: 70,
    breakfastTotal: '0',
    dinnerTotal: '170000',
  },
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function api(data: unknown = view) {
  const fetcher = vi.fn(
    async (_url: unknown, init?: RequestInit) =>
      new Response(init?.method ? null : JSON.stringify({ familyFood: data }), {
        status: init?.method ? 204 : 200,
      }),
  )
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
it('Mom sees item prices, exact totals, breakdown and comparison', async () => {
  api()
  render(<FamilyFoodExpenses parent />)
  expect(await screen.findByText('Synthetic dinner')).toBeTruthy()
  expect(screen.getAllByText('170.000 đ').length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText('100.000 đ')).toBeTruthy()
  expect(screen.getByText(/Tăng 70.000 đ/)).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Thêm chi phí ăn uống' }),
  ).toBeTruthy()
})
it('renders the real populated grocery response shape without a read error', async () => {
  const breakfast = {
    ...expense,
    id: '22222222-2222-4222-8222-222222222222',
    mealDate: '2026-11-08',
    mealType: 'BREAKFAST',
    category: 'BREAKFAST',
    items: [{ name: 'Bữa sáng', amount: '65000' }],
    total: '65000',
  }
  const dinner = {
    ...expense,
    id: '33333333-3333-4333-8333-333333333333',
    mealDate: '2026-11-07',
    mealType: 'DINNER',
    category: 'DINNER',
  }
  const groceries = {
    id: '44444444-4444-4444-8444-444444444444',
    mealDate: '2026-11-09',
    category: 'GROCERIES',
    amount: '420000',
    note: 'Thịt, rau, trứng',
    total: '420000',
  }
  api({
    ...view,
    month: '2026-11',
    totalCount: 3,
    expenses: [breakfast, dinner, groceries],
    summary: {
      ...view.summary,
      currentTotal: '665000',
      previousTotal: '0',
      previousMonth: '2026-10',
      differenceAmount: '665000',
      percentageChange: null,
      breakfastTotal: '65000',
      dinnerTotal: '180000',
      groceriesTotal: '420000',
      categories: [
        { category: 'BREAKFAST', amount: '65000' },
        { category: 'DINNER', amount: '180000' },
        { category: 'GROCERIES', amount: '420000' },
      ],
      dailyTrend: [{ date: '2026-11-09', amount: '420000' }],
      monthlyTrend: [{ month: '2026-11', amount: '665000' }],
    },
  })
  render(<FamilyFoodExpenses parent />)
  const totals = await screen.findByRole('region', { name: 'Tổng tiền ăn' })
  expect(totals.querySelector('.expense-total')?.textContent).toBe('665.000 đ')
  expect(totals.querySelector('.food-breakfast')?.textContent).toContain('65.000 đ')
  expect(totals.querySelector('.food-dinner')?.textContent).toContain('180.000 đ')
  expect(totals.querySelector('.food-groceries')?.textContent).toContain('420.000 đ')
  expect(screen.queryByText('Chưa xem được tiền ăn gia đình. Bạn thử lại nhé.')).toBeNull()
})
it.each([false])(
  'shared read-only view exposes no mutation controls',
  async (parent) => {
    api()
    render(<FamilyFoodExpenses parent={parent} />)
    expect(await screen.findByText('Soup')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Thêm chi phí|Sửa|Xóa/ }),
    ).toBeNull()
  },
)
it('Mom adds multiple items without guessed prices, collapses save, edits and confirms deletion', async () => {
  const f = api(),
    user = userEvent.setup()
  render(<FamilyFoodExpenses parent />)
  await screen.findByText('Soup')
  await user.click(screen.getByRole('button', { name: 'Thêm chi phí ăn uống' }))
  await user.type(screen.getByLabelText('Món / khoản chi 1'), 'Dish')
  await user.type(screen.getByLabelText('Giá 1'), '100000')
  await user.click(screen.getByRole('button', { name: '+ Thêm món / khoản' }))
  await user.type(screen.getByLabelText('Món / khoản chi 2'), 'Vegetables')
  await user.type(screen.getByLabelText('Giá 2'), '70000')
  expect(
    within(screen.getByRole('form', { name: 'Chi phí bữa ăn' })).getByText(
      '170.000 đ',
    ),
  ).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Lưu chi phí' }))
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  const sent = JSON.parse(
    f.mock.calls.find((c) => c[1]?.method === 'POST')![1]!.body as string,
  )
  expect(sent.items).toEqual([
    { name: 'Dish', amount: '100000' },
    { name: 'Vegetables', amount: '70000' },
  ])
  await user.click(screen.getByRole('button', { name: 'Sửa chi phí' }))
  expect(
    (screen.getByLabelText('Món / khoản chi 1') as HTMLInputElement).value,
  ).toBe('Synthetic dinner')
  await user.click(screen.getByRole('button', { name: 'Lưu chi phí' }))
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  expect(f.mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(true)
  const deleteAction = screen.getByRole('button', { name: 'Xóa chi phí' })
  await user.click(deleteAction)
  expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false)
  const dialog = screen.getByRole('dialog', { name: 'Xóa chi phí này?' })
  expect(
    dialog.textContent,
  ).toContain(
    `Bạn có chắc muốn xóa chi phí ngày ${expenseDate(today)}? Thao tác này không thể hoàn tác.`,
  )
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
  expect(document.activeElement).toBe(deleteAction)
  await user.click(deleteAction)
  await user.click(
    within(screen.getByRole('dialog', { name: 'Xóa chi phí này?' })).getByRole(
      'button',
      { name: 'Xóa chi phí' },
    ),
  )
  await waitFor(() =>
    expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(true),
  )
})
it('keeps shared family-food history compact and newest-first for read-only members', async () => {
  const records = [1, 2, 3, 4, 5].map((index) => ({
    ...expense,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    mealDate: `2026-11-0${index}`,
    items: [{ name: `Món ${index}`, amount: `${index}00000` }],
    total: `${index}00000`,
  }))
  api({ ...view, expenses: records, totalCount: 5 })
  render(<FamilyFoodExpenses parent={false} />)
  await screen.findByRole('heading', { name: 'Các bữa ăn đã ghi' })
  const section = screen.getByRole('heading', { name: 'Các bữa ăn đã ghi' }).closest('section') as HTMLElement
  expect(section.querySelectorAll('.food-records > li')).toHaveLength(3)
  expect(within(section).getByText('Món 5')).toBeTruthy()
  expect(within(section).queryByText('Món 1')).toBeNull()
  expect(within(section).queryByRole('button', { name: 'Sửa chi phí' })).toBeNull()
  expect(within(section).getByRole('button', { name: 'Xem thêm chi phí' })).toBeTruthy()
  await userEvent.click(within(section).getByRole('button', { name: 'Xem thêm chi phí' }))
  expect(section.querySelectorAll('.food-records > li')).toHaveLength(5)
  expect(within(section).getByText('Món 1')).toBeTruthy()
  await userEvent.click(within(section).getByRole('button', { name: 'Thu gọn' }))
  expect(section.querySelectorAll('.food-records > li')).toHaveLength(3)
})
it('Mom can quickly add and edit a standalone grocery expense', async () => {
  const f = api(),
    user = userEvent.setup()
  render(<FamilyFoodExpenses parent />)
  await screen.findByText('Soup')
  await user.click(screen.getByRole('button', { name: 'Thêm chi phí đi chợ' }))
  await user.type(screen.getByLabelText('Số tiền'), '350,000')
  expect((screen.getByLabelText('Số tiền') as HTMLInputElement).value).toBe(
    '350000',
  )
  await user.type(screen.getByLabelText('Ghi chú (không bắt buộc)'), 'Thịt, rau, trứng')
  await user.click(screen.getByRole('button', { name: 'Lưu chi phí đi chợ' }))
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  const sent = JSON.parse(
    f.mock.calls.find((c) => c[1]?.method === 'POST')![1]!.body as string,
  )
  expect(sent).toEqual({
    mealDate: today,
    category: 'GROCERIES',
    amount: '350000',
    note: 'Thịt, rau, trứng',
  })
})
it('Mom edits breakfast, dinner and groceries inline with one active editor', async () => {
  const breakfast = {
    ...expense,
    id: '22222222-2222-4222-8222-222222222222',
    mealDate: '2026-11-09',
    mealType: 'BREAKFAST' as const,
    category: 'BREAKFAST' as const,
    items: [{ name: 'Bữa sáng', amount: '65000' }],
    total: '65000',
  }
  const groceries = {
    id: '44444444-4444-4444-8444-444444444444',
    mealDate: '2026-11-08',
    category: 'GROCERIES' as const,
    amount: '420000',
    note: 'Thịt, rau, trứng',
    total: '420000',
  }
  const dinner = { ...expense, mealDate: '2026-11-10' }
  const f = api({
    ...view,
    totalCount: 3,
    expenses: [breakfast, dinner, groceries],
    summary: {
      ...view.summary,
      currentTotal: '655000',
      previousTotal: '0',
      differenceAmount: '655000',
      percentageChange: null,
      breakfastTotal: '65000',
      dinnerTotal: '170000',
      groceriesTotal: '420000',
      categories: [
        { category: 'BREAKFAST', amount: '65000' },
        { category: 'DINNER', amount: '170000' },
        { category: 'GROCERIES', amount: '420000' },
      ],
    },
  })
  const user = userEvent.setup()
  render(<FamilyFoodExpenses parent />)
  const section = (await screen
    .findByRole('heading', { name: 'Các bữa ăn đã ghi' }))
    .closest('section') as HTMLElement
  const breakfastRecord = within(section)
    .getAllByRole('heading', { level: 4 })
    .find((heading) => heading.textContent?.includes('Bữa sáng'))!
    .closest('li') as HTMLElement
  const dinnerRecord = within(section)
    .getAllByRole('heading', { level: 4 })
    .find((heading) => heading.textContent?.includes('Bữa tối'))!
    .closest('li') as HTMLElement
  const groceryRecord = within(section)
    .getAllByRole('heading', { level: 4 })
    .find((heading) => heading.textContent?.includes('Đi chợ / nguyên liệu'))!
    .closest('li') as HTMLElement
  await user.click(within(breakfastRecord).getByRole('button', { name: 'Sửa chi phí' }))
  expect(within(breakfastRecord).getByRole('form', { name: 'Chi phí bữa ăn' })).toBeTruthy()
  expect(within(section).getAllByRole('form')).toHaveLength(1)
  await user.click(within(dinnerRecord).getByRole('button', { name: 'Sửa chi phí' }))
  expect(within(breakfastRecord).queryByRole('form')).toBeNull()
  expect(within(dinnerRecord).getByRole('form', { name: 'Chi phí bữa ăn' })).toBeTruthy()
  await user.click(
    within(dinnerRecord).getByRole('button', { name: 'Đóng biểu mẫu' }),
  )
  expect(within(section).queryByRole('form')).toBeNull()
  await user.click(within(groceryRecord).getByRole('button', { name: 'Sửa chi phí' }))
  expect(within(dinnerRecord).queryByRole('form')).toBeNull()
  expect(within(groceryRecord).getByRole('form', { name: 'Chi phí đi chợ' })).toBeTruthy()
  await user.click(
    within(groceryRecord).getByRole('button', { name: 'Lưu chi phí đi chợ' }),
  )
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  expect(f.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true)
})
it('sanitizes meal item prices and rejects invalid amounts with a Vietnamese message', async () => {
  const f = api()
  render(<FamilyFoodExpenses parent />)
  await screen.findByText('Soup')
  await userEvent.click(screen.getByRole('button', { name: 'Thêm chi phí ăn uống' }))
  await userEvent.type(screen.getByLabelText('Món / khoản chi 1'), 'Dish')
  const price = screen.getByLabelText('Giá 1') as HTMLInputElement
  fireEvent.change(price, { target: { value: '85.000' } })
  expect(price.value).toBe('85000')
  await userEvent.click(screen.getByRole('button', { name: 'Lưu chi phí' }))
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  const sent = JSON.parse(
    f.mock.calls.find((call) => call[1]?.method === 'POST')![1]!.body as string,
  )
  expect(sent.items).toEqual([{ name: 'Dish', amount: '85000' }])

  await userEvent.click(screen.getByRole('button', { name: 'Thêm chi phí ăn uống' }))
  await userEvent.clear(screen.getByLabelText('Món / khoản chi 1'))
  await userEvent.type(screen.getByLabelText('Món / khoản chi 1'), 'Dish')
  fireEvent.change(screen.getByLabelText('Giá 1'), {
    target: { value: '0' },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Lưu chi phí' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Số tiền phải từ 1 đến 1.000.000.000 đ.',
  )
  expect(
    f.mock.calls.filter((call) => call[1]?.method === 'POST'),
  ).toHaveLength(1)
})
it('network failure is safe and retry restores real data', async () => {
  const f = api()
  f.mockRejectedValueOnce(new Error('private error'))
  render(<FamilyFoodExpenses parent />)
  expect((await screen.findByRole('alert')).textContent).not.toContain(
    'private error',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Soup')).toBeTruthy()
})
it('Bếp shows itemized costs without management controls', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ expense }))),
  )
  render(<MealFoodCost date={today} mealType="DINNER" />)
  expect(await screen.findByText('Synthetic dinner')).toBeTruthy()
  expect(screen.getByText('170.000 đ')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Sửa|Xóa|Thêm/ })).toBeNull()
})
it.each([true, false])(
  'empty shared month is honest for parent=%s',
  async (parent) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              familyFood: {
                ...view,
                totalCount: 0,
                expenses: [],
                summary: {
                  ...view.summary,
                  currentTotal: '0',
                  previousTotal: '0',
                  differenceAmount: '0',
                  percentageChange: null,
                  breakfastTotal: '0',
                  dinnerTotal: '0',
                  groceriesTotal: '0',
                  categories: [
                    { category: 'BREAKFAST', amount: '0' },
                    { category: 'DINNER', amount: '0' },
                    { category: 'GROCERIES', amount: '0' },
                  ],
                  dailyTrend: Array.from({ length: daysInMonth }, (_, index) => ({
                    date: `${month}-${String(index + 1).padStart(2, '0')}`,
                    amount: '0',
                  })),
                  monthlyTrend: Array.from({ length: 6 }, (_, index) => ({
                    month: `2026-${String(index + 5).padStart(2, '0')}`,
                    amount: '0',
                  })),
                },
              },
            }),
          ),
      ),
    )
    render(<FamilyFoodExpenses parent={parent} />)
    expect(
      await screen.findByText('Chưa có chi phí ăn uống trong tháng này'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        parent
          ? 'Thêm chi phí sau khi mua hoặc chuẩn bị bữa ăn.'
          : 'Khi mẹ thêm chi phí bữa ăn, thông tin sẽ xuất hiện ở đây.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/Infinity|NaN/)).toBeNull()
  },
)
it('meal assistance prefills editable names only and never invents prices', async () => {
  const f = api()
  f.mockImplementation(
    async (url, init) =>
      new Response(
        init?.method
          ? null
          : JSON.stringify(
              String(url).includes('/prefill')
                ? { names: ['Suggested dinner', 'Suggested soup'] }
                : { familyFood: view },
            ),
        { status: init?.method ? 204 : 200 },
      ),
  )
  render(<FamilyFoodExpenses parent />)
  await screen.findByText('Soup')
  await userEvent.click(
    screen.getByRole('button', { name: 'Thêm chi phí ăn uống' }),
  )
  await userEvent.selectOptions(screen.getByLabelText('Bữa'), 'DINNER')
  await userEvent.click(
    screen.getByRole('button', { name: 'Gợi ý món từ Bếp' }),
  )
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Món / khoản chi 1') as HTMLInputElement).value,
    ).toBe('Suggested dinner'),
  )
  expect((screen.getByLabelText('Giá 1') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Giá 2') as HTMLInputElement).value).toBe('')
  expect(
    screen.getByRole('button', { name: '+ Thêm món / khoản' }),
  ).toBeTruthy()
})
it('slot conflict guides Mom to edit the existing meal and preserves the form', async () => {
  const f = api()
  f.mockImplementation(
    async (_url, init) =>
      new Response(
        JSON.stringify(
          init?.method
            ? { error: { code: 'FOOD_SLOT_EXISTS', message: 'SQL private' } }
            : { familyFood: view },
        ),
        { status: init?.method ? 409 : 200 },
      ),
  )
  render(<FamilyFoodExpenses parent />)
  await screen.findByText('Soup')
  await userEvent.click(screen.getByRole('button', { name: 'Sửa chi phí' }))
  await userEvent.click(screen.getByRole('button', { name: 'Lưu chi phí' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Sửa chi phí',
  )
  expect(screen.getByRole('form')).toBeTruthy()
  expect(screen.queryByText('SQL private')).toBeNull()
})
it('saved shared costs refresh from the API on remount', async () => {
  const f = api(),
    v = render(<FamilyFoodExpenses parent={false} />)
  await screen.findByText('Synthetic dinner')
  v.unmount()
  render(<FamilyFoodExpenses parent={false} />)
  expect(await screen.findByText('Synthetic dinner')).toBeTruthy()
  expect(f).toHaveBeenCalledTimes(2)
})
