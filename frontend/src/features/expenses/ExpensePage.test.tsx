import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthenticatedShell } from '../auth/AuthenticatedShell'
import { ExpensePage } from './ExpensePage'
import type { PersonalExpenseWorkspace } from './expense-api'
import { familyDate } from '../meals/family-time'

const id = '11111111-1111-4111-8111-111111111111',
  today = familyDate(),
  month = today.slice(0, 7)
function workspace(): PersonalExpenseWorkspace {
  return {
    month,
    currency: 'VND',
    page: 1,
    totalCount: 1,
    hasMore: false,
    expenses: [
      {
        id,
        amount: '120000',
        spentOn: today,
        category: 'TRANSPORT',
        note: 'Khoản chi tổng hợp',
      },
    ],
    summary: {
      currentTotal: '120000',
      previousMonth: month.endsWith('-01')
        ? `${Number(month.slice(0, 4)) - 1}-12`
        : month.slice(0, 5) +
          String(Number(month.slice(5)) - 1).padStart(2, '0'),
      previousTotal: '100000',
      differenceAmount: '20000',
      percentageChange: 20,
      categories: [{ category: 'TRANSPORT', amount: '120000' }],
    },
  }
}
function network(data = workspace(), readError = false, writeError = false) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url === '/api/notifications')
        return new Response(
          JSON.stringify({ notifications: [], unreadCount: 0 }),
        )
      if (!url.startsWith('/api/expenses/personal'))
        return new Response(JSON.stringify({ home: {} }))
      if (!init?.method) {
        if (readError) throw new Error('private network detail')
        const params = new URL(url, 'http://synthetic').searchParams
        const selectedMonth = params.get('month') ?? data.month,
          page = Number(params.get('page') ?? 1)
        const result =
          selectedMonth === data.month
            ? { ...data, page, hasMore: page * 20 < data.totalCount }
            : {
                ...data,
                month: selectedMonth,
                page,
                totalCount: 0,
                hasMore: false,
                expenses: [],
                summary: {
                  ...data.summary,
                  currentTotal: '0',
                  previousTotal: '0',
                  differenceAmount: '0',
                  percentageChange: null,
                  categories: [],
                },
              }
        return new Response(JSON.stringify({ personalExpenses: result }))
      }
      if (writeError)
        return new Response(
          JSON.stringify({
            error: {
              code: 'EXPENSE_UNAVAILABLE',
              message: 'private SQL detail',
            },
          }),
          { status: 503 },
        )
      if (init.method === 'DELETE')
        data.expenses = data.expenses.filter(
          (expense) => !url.endsWith(expense.id),
        )
      else {
        const body = JSON.parse(String(init.body))
        if (init.method === 'POST') data.expenses.unshift({ id, ...body })
        else
          data.expenses = data.expenses.map((expense) =>
            url.endsWith(expense.id) ? { id: expense.id, ...body } : expense,
          )
      }
      return new Response(null, { status: 204 })
    }),
  )
  return calls
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function ready() {
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  await screen.findByRole('button', { name: 'Thêm chi tiêu' })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('opens Mom spending workspace without adding a sixth navigation item', async () => {
  const calls = network()
  render(
    <AuthenticatedShell
      profile={{
        id: '11111111-1111-4111-8111-111111111111',
        role: 'PARENT',
        displayName: 'Synthetic',
        avatarType: null,
        avatarValue: null,
      }}
      isLoggingOut={false}
      error={null}
      onLogout={() => {}}
    />,
  )
  const nav = within(
    screen.getByRole('navigation', { name: 'Điều hướng chính' }),
  )
  expect(nav.getAllByRole('button')).toHaveLength(5)
  fireEvent.click(nav.getByRole('button', { name: 'Chi tiêu' }))
  expect(await screen.findByRole('heading', { name: 'Chi tiêu' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Cá nhân' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Tiền ăn gia đình' })).toBeTruthy()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Tiền ăn gia đình' }))
  expect(screen.getByText('Sắp có')).toBeTruthy()
  expect(screen.queryByText('120.000 đ')).toBeNull()
  expect(calls.some((c) => /household|food-expense/.test(c.url))).toBe(false)
  fireEvent.click(screen.getByRole('tab', { name: 'Cá nhân' }))
  await ready()
})
it.each(['ADMIN', 'MEMBER'] as const)(
  '%s opens private expenses through Cá nhân with the same five navigation items',
  async (role) => {
    const calls = network()
    render(
      <AuthenticatedShell
        profile={{
          id,
          role,
          displayName: 'Synthetic',
          avatarType: null,
          avatarValue: null,
        }}
        isLoggingOut={false}
        error={null}
        onLogout={() => {}}
      />,
    )
    const nav = within(
      screen.getByRole('navigation', { name: 'Điều hướng chính' }),
    )
    expect(nav.getAllByRole('button')).toHaveLength(5)
    expect(nav.queryByRole('button', { name: 'Chi tiêu' })).toBeNull()
    fireEvent.click(nav.getByRole('button', { name: 'Cá nhân' }))
    expect(screen.queryByRole('button', { name: 'Thêm chi tiêu' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mở chi tiêu cá nhân' }))
    await ready()
    expect(
      nav.getByRole('button', { name: 'Cá nhân' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.queryByRole('tab', { name: 'Tiền ăn gia đình' })).toBeNull()
    expect(
      calls
        .filter((c) => c.url.startsWith('/api/expenses/personal'))
        .every((c) => !/owner|memberId/.test(c.url)),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Về Cá nhân' }))
    expect(
      screen.getByRole('button', { name: 'Mở chi tiêu cá nhân' }),
    ).toBeTruthy()
  },
)
it('creates an expense with exact whole-dong money, refreshes totals and persists on remount', async () => {
  const data = workspace()
  data.expenses = []
  data.totalCount = 0
  data.summary = {
    ...data.summary,
    currentTotal: '0',
    previousTotal: '0',
    differenceAmount: '0',
    percentageChange: null,
    categories: [],
  }
  const calls = network(data),
    view = render(<ExpensePage parent={false} />)
  await ready()
  expect(
    screen.getByText('Chưa có khoản chi nào trong tháng này.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Thêm chi tiêu' }))
  change('Số tiền (đ)', '120000')
  change('Danh mục', 'TRANSPORT')
  change('Ghi chú khoản chi (không bắt buộc)', 'Khoản chi dùng thử')
  data.totalCount = 1
  data.summary = {
    ...data.summary,
    currentTotal: '120000',
    differenceAmount: '120000',
    categories: [{ category: 'TRANSPORT', amount: '120000' }],
  }
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(screen.getByText('Khoản chi dùng thử')).toBeTruthy()
  expect(
    within(
      screen.getByRole('region', { name: 'Tổng quan chi tiêu cá nhân' }),
    ).getByText('120.000 đ'),
  ).toBeTruthy()
  const write = calls.find((c) => c.init?.method === 'POST')!
  expect(JSON.parse(String(write.init!.body))).toMatchObject({
    amount: '120000',
    spentOn: today,
    category: 'TRANSPORT',
  })
  expect(String(write.init!.body)).not.toMatch(/owner|currency/)
  view.unmount()
  render(<ExpensePage parent={false} />)
  await ready()
  expect(screen.getByText('Khoản chi dùng thử')).toBeTruthy()
})
it('edits the saved identity and requires confirmation before deletion', async () => {
  const calls = network()
  render(<ExpensePage parent={false} />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Sửa khoản chi 1' }))
  change('Số tiền (đ)', '130000')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe(
    `/api/expenses/personal/${id}`,
  )
  expect(screen.getByText('130.000 đ')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Xóa khoản chi 1' }))
  expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Giữ lại' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Xóa khoản chi 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa khoản chi' }))
  await ready()
  expect(calls.find((c) => c.init?.method === 'DELETE')!.url).toBe(
    `/api/expenses/personal/${id}`,
  )
  expect(screen.queryByText('Khoản chi tổng hợp')).toBeNull()
})
it('shows neutral month comparison and only actual category totals', async () => {
  network()
  render(<ExpensePage parent={false} />)
  await ready()
  expect(screen.getByText('Tăng 20.000 đ · 20%')).toBeTruthy()
  const categories = within(
    screen.getByRole('region', { name: 'Chi theo danh mục' }),
  )
  expect(categories.getByText('Di chuyển')).toBeTruthy()
  expect(categories.queryByText('Mua sắm')).toBeNull()
  expect(screen.queryByText(/vượt ngân sách|quá nhiều/i)).toBeNull()
})
it('supports keyboard switching to the family placeholder without a food API', async () => {
  const calls = network()
  render(<ExpensePage parent />)
  await ready()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Cá nhân' }), {
    key: 'ArrowRight',
  })
  const family = screen.getByRole('tab', { name: 'Tiền ăn gia đình' })
  expect(family.getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(family)
  expect(screen.getByText('Sắp có')).toBeTruthy()
  fireEvent.keyDown(family, { key: 'Home' })
  await ready()
  expect(
    screen.getByRole('tab', { name: 'Cá nhân' }).getAttribute('aria-selected'),
  ).toBe('true')
  expect(calls.some((call) => /household|food-expense/.test(call.url))).toBe(
    false,
  )
})
it('filters historical months and pages without inventing a misleading current-month label', async () => {
  const data = workspace()
  data.totalCount = 21
  data.hasMore = true
  const calls = network(data)
  render(<ExpensePage parent={false} />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  await waitFor(() =>
    expect(calls.some((c) => c.url.includes('page=2'))).toBe(true),
  )
  await screen.findByRole('button', { name: 'Thêm chi tiêu' })
  change('Tháng xem chi tiêu', '2026-01')
  await waitFor(() =>
    expect(
      calls.some(
        (c) => c.url.includes('month=2026-01') && c.url.includes('page=1'),
      ),
    ).toBe(true),
  )
  expect(await screen.findByText('Tháng 1/2026')).toBeTruthy()
})
it('handles loading, safe retry and honest zero previous-month comparison', async () => {
  network(workspace(), true)
  render(<ExpensePage parent={false} />)
  expect(
    screen.getByRole('status', { name: 'Tải chi tiêu cá nhân' }),
  ).toBeTruthy()
  expect(await screen.findByRole('alert')).toBeTruthy()
  const data = workspace()
  data.summary = {
    ...data.summary,
    previousTotal: '0',
    differenceAmount: '120000',
    percentageChange: null,
  }
  network(data)
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại chi tiêu' }))
  await ready()
  expect(
    screen.getByText(/Tháng trước chưa ghi khoản chi, chưa tính tỷ lệ/),
  ).toBeTruthy()
  expect(screen.queryByText(/Infinity|NaN|private network detail/)).toBeNull()
})
it('preserves failed drafts and never shows internal server messages', async () => {
  network(workspace(), false, true)
  render(<ExpensePage parent={false} />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Thêm chi tiêu' }))
  change('Số tiền (đ)', '120000')
  fireEvent.submit(screen.getByRole('form'))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect((screen.getByLabelText('Số tiền (đ)') as HTMLInputElement).value).toBe(
    '120000',
  )
  expect(screen.queryByText('private SQL detail')).toBeNull()
})
