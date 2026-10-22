import {
  cleanup,
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
const id = '11111111-1111-4111-8111-111111111111'
const today = familyDate(),
  month = today.slice(0, 7),
  priorDate = new Date(month + '-01T12:00:00Z')
priorDate.setUTCMonth(priorDate.getUTCMonth() - 1)
const expense = {
  id,
  mealDate: today,
  mealType: 'DINNER',
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
function api() {
  const fetcher = vi.fn(
    async (_url: unknown, init?: RequestInit) =>
      new Response(init?.method ? null : JSON.stringify({ familyFood: view }), {
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
  await user.click(screen.getByRole('button', { name: 'Xóa chi phí' }))
  expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))
  await waitFor(() =>
    expect(f.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(true),
  )
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
