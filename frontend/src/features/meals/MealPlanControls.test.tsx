/// <reference types="node" />
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MealPlanControls } from './MealPlanControls'
import type { MealRequest } from './meal-request-api'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const mealsCss = readFileSync(resolve('src/features/meals/meals.css'), 'utf8')
const id = '11111111-1111-4111-8111-111111111111'
const request: MealRequest = {
  id,
  mealDate: '2099-06-01',
  mealType: 'DINNER',
  mode: 'OPEN_CHOICE',
  status: 'OPEN',
  deadlineAt: '2099-06-01T12:00:00Z',
  parentMessage: 'Gợi ý món nhé',
  createdBy: { id, displayName: 'Synthetic Parent' },
  options: [],
  createdAt: '2099-06-01T00:00:00Z',
  updatedAt: '2099-06-01T00:00:00Z',
  timeZone: 'Asia/Ho_Chi_Minh',
  isOpen: true,
  responses: [
    {
      member: {
        id,
        displayName: 'Synthetic Child',
        avatarType: null,
        avatarValue: null,
      },
      state: 'CUSTOM',
      option: null,
      customText: 'Canh cải',
      updatedAt: '2099-06-01T00:00:00Z',
    },
  ],
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('whole meal plan controls', () => {
  it('keeps mobile option actions spaced and touch targets at least 44px', async () => {
    const style = document.createElement('style')
    style.textContent = mealsCss
    document.head.appendChild(style)
    try {
      const user = userEvent.setup()
      render(
        <MealPlanControls
          request={{
            ...request,
            mode: 'OPTION_POLL',
            options: [
              { id, label: 'Cơm', sortOrder: 1 },
              {
                id: '22222222-2222-4222-8222-222222222222',
                label: 'Bún',
                sortOrder: 2,
              },
            ],
          }}
          onChanged={() => {}}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
      const add = screen.getByRole('button', { name: 'Thêm lựa chọn' })
      expect(getComputedStyle(add).marginTop).not.toBe('0px')
      expect(getComputedStyle(add.parentElement!).gap).toBe('1rem')
      expect(
        getComputedStyle(screen.getByRole('button', { name: 'Lưu kế hoạch' }))
          .minHeight,
      ).toBe('44px')
    } finally {
      style.remove()
    }
  })
  it('directly changes mode with explicit incompatible-response confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ request: { ...request, mode: 'OPTION_POLL' } }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MealPlanControls request={request} onChanged={() => {}} />)
    expect(screen.getAllByRole('button', { name: 'Chỉnh sửa' })).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Chuyển sang tự túc' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'OPTION_POLL',
    )
    await user.type(screen.getByLabelText('Lựa chọn 1'), 'Cơm')
    await user.type(screen.getByLabelText('Lựa chọn 2'), 'Bún')
    await user.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }))
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'Chỉ các phản hồi không còn phù hợp sẽ bị xóa',
    )
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Đồng ý, lưu kế hoạch' }),
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      mode: 'OPTION_POLL',
      confirmResponseReset: true,
      options: ['Cơm', 'Bún'],
    })
  })
  it('confirms cancellation, retains the row identity, and can back out', async () => {
    const user = userEvent.setup()
    const changed = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ request: { ...request, status: 'CANCELLED', isOpen: false } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<MealPlanControls request={request} onChanged={changed} />)
    await user.click(screen.getByRole('button', { name: 'Xóa kế hoạch' }))
    await user.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Xóa kế hoạch' }))
    await user.click(
      screen.getByRole('button', { name: 'Đồng ý, xóa kế hoạch' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/meals/requests/${id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      }),
    )
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ id, status: 'CANCELLED' }),
    )
  })
  it('requires confirmation if the server finds a newly arrived incompatible response', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ error: { code: 'MEAL_RESPONSE_RESET_REQUIRED' } }, 409),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MealPlanControls
        request={{ ...request, responses: [] }}
        onChanged={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    await user.selectOptions(
      screen.getByLabelText('Cách cả nhà trả lời'),
      'SELF_SERVICE',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }))
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).confirmResponseReset,
    ).toBe(false)
  })
  it('allows editing a cancelled slot with the same full form', async () => {
    const user = userEvent.setup()
    render(
      <MealPlanControls
        request={{ ...request, status: 'CANCELLED' }}
        onChanged={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    expect(
      (screen.getByLabelText('Lời nhắn cho cả nhà') as HTMLTextAreaElement)
        .value,
    ).toBe('Gợi ý món nhé')
    expect(screen.queryByRole('button', { name: 'Hủy kế hoạch' })).toBeNull()
  })
})
