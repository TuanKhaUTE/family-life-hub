import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AssessmentSharing } from './AssessmentSharing'
import { ReceivedShares } from './ReceivedShares'
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222'
const recipient = {
  id: other,
  displayName: 'Người nhận thử nghiệm',
  avatarType: null,
  avatarValue: null,
}
const record = {
  id,
  resourceType: 'STUDY_ASSESSMENT',
  sharedAt: '2026-10-22T00:00:00Z',
  owner: {
    displayName: 'Người gửi thử nghiệm',
    avatarType: null,
    avatarValue: null,
  },
  assessment: {
    courseName: 'Môn thử nghiệm',
    title: 'Giữa kỳ thử nghiệm',
    assessmentType: 'MIDTERM',
    score: 8.7,
    maxScore: 10,
    percentage: 87,
    letterGrade: null,
    assessedAt: '2026-10-22',
  },
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('contains forward/backward Tab focus with two eligible radio recipients before selection', async () => {
  const second = {
    ...recipient,
    id: '33333333-3333-4333-8333-333333333333',
    displayName: 'Người nhận thứ hai',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            sharing: { recipients: [recipient, second], shares: [] },
          }),
        ),
    ),
  )
  const user = userEvent.setup()
  render(
    <>
      <button>Trước hộp</button>
      <AssessmentSharing assessmentId={id} title="Bài thử" />
      <button>Sau hộp</button>
    </>,
  )
  await user.click(screen.getByRole('button', { name: 'Chia sẻ Bài thử' }))
  await screen.findByRole('radio', { name: second.displayName })
  const close = screen.getByRole('button', { name: 'Đóng chia sẻ' }),
    first = screen.getByRole('radio', { name: recipient.displayName })
  expect(document.activeElement).toBe(close)
  await user.tab()
  expect(document.activeElement).toBe(first)
  await user.tab()
  expect(document.activeElement).toBe(close)
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(first)
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(close)
  await user.click(screen.getByRole('radio', { name: second.displayName }))
  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Chia sẻ kết quả' }),
  )
  await user.tab()
  expect(document.activeElement).toBe(close)
})
function network() {
  let shared = false
  const f = vi.fn(async (url: unknown, init?: RequestInit) => {
    if (init?.method === 'POST') {
      shared = true
      return new Response(JSON.stringify({ shareId: id }), { status: 201 })
    }
    if (init?.method === 'DELETE') {
      shared = false
      return new Response(null, { status: 204 })
    }
    return new Response(
      JSON.stringify(
        String(url).includes('/received')
          ? {
              received: {
                records: shared ? [record] : [],
                page: 1,
                totalCount: shared ? 1 : 0,
                hasMore: false,
              },
            }
          : {
              sharing: {
                recipients: [recipient],
                shares: shared
                  ? [{ id, recipient, sharedAt: record.sharedAt }]
                  : [],
              },
            },
      ),
    )
  })
  vi.stubGlobal('fetch', f)
  return f
}
it('sharing requires an explicit recipient and confirm; owners can revoke without deleting the source', async () => {
  const f = network(),
    user = userEvent.setup()
  render(<AssessmentSharing assessmentId={id} title="Giữa kỳ thử nghiệm" />)
  await user.click(
    screen.getByRole('button', { name: 'Chia sẻ Giữa kỳ thử nghiệm' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Chia sẻ kết quả' })
  expect(await within(dialog).findByText('Riêng tư')).toBeTruthy()
  expect(f.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false)
  expect(
    (
      within(dialog).getByRole('button', {
        name: 'Chia sẻ kết quả',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true)
  await user.click(
    within(dialog).getByRole('radio', { name: 'Người nhận thử nghiệm' }),
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Chia sẻ kết quả' }),
  )
  expect(
    await within(dialog).findByText('Đã chia sẻ với Người nhận thử nghiệm'),
  ).toBeTruthy()
  expect(
    JSON.parse(
      f.mock.calls.find((c) => c[1]?.method === 'POST')![1]!.body as string,
    ),
  ).toEqual({
    resourceType: 'STUDY_ASSESSMENT',
    resourceId: id,
    recipientMemberId: other,
  })
  await user.click(
    within(dialog).getByRole('button', {
      name: 'Ngừng chia sẻ với Người nhận thử nghiệm',
    }),
  )
  expect(await within(dialog).findByText('Riêng tư')).toBeTruthy()
  expect(
    f.mock.calls.filter((c) => c[1]?.method === 'DELETE').map((c) => c[0]),
  ).toEqual(['/api/shares/' + id])
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Chia sẻ Giữa kỳ thử nghiệm' }),
  )
})
it('received results show only the safe read-only projection, with Vietnamese numbers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            received: {
              records: [
                {
                  ...record,
                  privateNote: 'secret note',
                  assessment: { ...record.assessment, note: 'hidden private' },
                },
              ],
              page: 1,
              totalCount: 1,
              hasMore: false,
            },
          }),
        ),
    ),
  )
  render(<ReceivedShares />)
  expect(
    await screen.findByText('Môn thử nghiệm · Giữa kỳ thử nghiệm'),
  ).toBeTruthy()
  expect(screen.getByText('8,7/10 · 87%')).toBeTruthy()
  expect(screen.getByText('Được Người gửi thử nghiệm chia sẻ')).toBeTruthy()
  expect(screen.queryByText(/secret note|hidden private/)).toBeNull()
  expect(screen.queryByRole('button', { name: /Chia sẻ|Sửa|Xóa/ })).toBeNull()
})
it('recipient loses the item on the next refresh after revoke', async () => {
  const f = network()
  f.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        received: { records: [record], page: 1, totalCount: 1, hasMore: false },
      }),
    ),
  )
  render(<ReceivedShares />)
  await screen.findByText('Môn thử nghiệm · Giữa kỳ thử nghiệm')
  await userEvent.click(screen.getByRole('button', { name: 'Làm mới chia sẻ' }))
  expect(
    await screen.findByText('Chưa có kết quả nào được chia sẻ với bạn.'),
  ).toBeTruthy()
  expect(screen.queryByText('Môn thử nghiệm · Giữa kỳ thử nghiệm')).toBeNull()
})
it('received loading/error/retry is safe and does not fetch private modules', async () => {
  const f = network()
  f.mockRejectedValueOnce(new Error('private SQL'))
  render(<ReceivedShares />)
  expect(screen.getByRole('status')).toBeTruthy()
  expect((await screen.findByRole('alert')).textContent).not.toContain(
    'private SQL',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(
    await screen.findByText('Chưa có kết quả nào được chia sẻ với bạn.'),
  ).toBeTruthy()
  expect(
    f.mock.calls.every((c) => String(c[0]).startsWith('/api/shares/received')),
  ).toBe(true)
})
it('owner load failure retries without inventing eligible recipients', async () => {
  const f = network()
  f.mockRejectedValueOnce(new Error('private'))
  render(<AssessmentSharing assessmentId={id} title="Bài thử" />)
  await userEvent.click(screen.getByRole('button', { name: 'Chia sẻ Bài thử' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('radio')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(
    await screen.findByRole('radio', { name: recipient.displayName }),
  ).toBeTruthy()
})
it('sharing state is loaded again on reopening, without automatic reshare', async () => {
  const f = network()
  await f('/api/shares', { method: 'POST' })
  render(<AssessmentSharing assessmentId={id} title="Bài thử" />)
  await userEvent.click(screen.getByRole('button', { name: 'Chia sẻ Bài thử' }))
  expect(
    await within(screen.getByRole('dialog')).findByText(
      'Đã chia sẻ với Người nhận thử nghiệm',
    ),
  ).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Đóng chia sẻ' }))
  await userEvent.click(screen.getByRole('button', { name: 'Chia sẻ Bài thử' }))
  await waitFor(() =>
    expect(
      within(screen.getByRole('dialog')).getByText(
        'Đã chia sẻ với Người nhận thử nghiệm',
      ),
    ).toBeTruthy(),
  )
  expect(f.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1)
})
