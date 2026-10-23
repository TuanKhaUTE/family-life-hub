import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalPage } from './PersonalPage'
import * as api from './profile-api'
vi.mock('./avatar-image', () => ({
  AvatarInputError: class AvatarInputError extends Error {},
  normalizeAvatarImage: vi.fn(async () =>
    new Blob(['synthetic webp'], { type: 'image/webp' }),
  ),
}))
vi.mock('./profile-api', async (original) => {
  const actual = await original<typeof api>()
  return {
    ...actual,
    fetchSettings: vi.fn(),
    saveProfile: vi.fn(),
    changePin: vi.fn(),
    resetMembers: vi.fn(),
    resetPin: vi.fn(),
    uploadAvatar: vi.fn(),
  }
})
vi.mock('../sharing/ReceivedShares', () => ({
  ReceivedShares: () => <h2>Được chia sẻ với bạn</h2>,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
it('keyboard avatar selection and cancel return focus to the profile edit action', async () => {
  // JSDOM lacks CSS.escape used by user-event's native radio-arrow emulation.
  vi.stubGlobal('CSS', {
    escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
  })
  const u = userEvent.setup()
  render(<PersonalPage profile={profile} onExpenses={vi.fn()} />)
  const edit = await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' })
  await u.click(edit)
  expect(document.activeElement).toBe(screen.getByLabelText('Tên hiển thị'))
  await u.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('radio', { name: 'Chữ cái đầu' }),
  )
  await u.keyboard('{ArrowRight}')
  expect(
    (screen.getByRole('radio', { name: 'Chiếc lá' }) as HTMLInputElement)
      .checked,
  ).toBe(true)
  await u.click(screen.getByRole('button', { name: 'Hủy' }))
  await waitFor(() => expect(document.activeElement).toBe(edit))
  expect(api.saveProfile).not.toHaveBeenCalled()
})
const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
beforeEach(() => {
  vi.mocked(api.fetchSettings).mockResolvedValue({
    profile,
    avatarChoices: [
      { avatarType: 'EMOJI', avatarValue: '🌿', label: 'Chiếc lá' },
      { avatarType: 'EMOJI', avatarValue: '🐱', label: 'Mèo con' },
    ],
  })
  vi.mocked(api.resetMembers).mockResolvedValue([
    {
      ...profile,
      id: '22222222-2222-4222-8222-222222222222',
      displayName: 'Synthetic Other',
    },
  ])
  vi.mocked(api.changePin).mockResolvedValue()
  vi.mocked(api.resetPin).mockResolvedValue()
})
it('edits own name/avatar, updates shell and collapses after saving', async () => {
  const u = userEvent.setup(),
    updated = vi.fn()
  vi.mocked(api.saveProfile).mockResolvedValue({
    ...profile,
    displayName: 'Synthetic Updated',
    avatarType: 'EMOJI',
    avatarValue: '🐱',
  })
  render(
    <PersonalPage
      profile={profile}
      onExpenses={vi.fn()}
      onProfileUpdated={updated}
    />,
  )
  await u.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }))
  const name = screen.getByLabelText('Tên hiển thị')
  await u.clear(name)
  await u.type(name, 'Synthetic Updated')
  await u.click(screen.getByRole('radio', { name: 'Mèo con' }))
  expect(
    (screen.getByRole('radio', { name: 'Mèo con' }) as HTMLInputElement)
      .checked,
  ).toBe(true)
  await u.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
  await screen.findByText('Đã cập nhật hồ sơ của bạn.')
  expect(api.saveProfile).toHaveBeenCalledWith({
    displayName: 'Synthetic Updated',
    avatarType: 'EMOJI',
    avatarValue: '🐱',
  })
  expect(updated).toHaveBeenCalled()
  expect(screen.queryByLabelText('Tên hiển thị')).toBeNull()
})
it('previews a device photo and uploads it only after saving the profile', async () => {
  const u = userEvent.setup(),
    updated = vi.fn(),
    uploadAvatar = (api as unknown as {
      uploadAvatar: ReturnType<typeof vi.fn>
    }).uploadAvatar
  uploadAvatar.mockResolvedValue({
    ...profile,
    avatarType: 'IMAGE',
    avatarValue: '/api/profile/avatar/' + profile.id + '?v=2',
  })
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:synthetic-avatar'),
    revokeObjectURL: vi.fn(),
  })
  render(
    <PersonalPage
      profile={profile}
      onExpenses={vi.fn()}
      onProfileUpdated={updated}
    />,
  )
  await u.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }))
  const file = new File(['synthetic image'], 'avatar.png', { type: 'image/png' })
  await u.upload(screen.getByLabelText('Chọn ảnh từ thiết bị'), file)
  expect(uploadAvatar).not.toHaveBeenCalled()
  expect(screen.getByAltText('Xem trước ảnh đại diện')).toBeTruthy()
  await u.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
  await waitFor(() => expect(uploadAvatar).toHaveBeenCalledTimes(1))
  expect(uploadAvatar.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
  expect(updated).toHaveBeenCalledWith(
    expect.objectContaining({ avatarType: 'IMAGE' }),
  )
})
it('cancels a selected device photo without uploading it', async () => {
  const u = userEvent.setup(),
    uploadAvatar = (api as unknown as {
      uploadAvatar: ReturnType<typeof vi.fn>
    }).uploadAvatar
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:cancelled-avatar'),
    revokeObjectURL: vi.fn(),
  })
  render(<PersonalPage profile={profile} onExpenses={vi.fn()} />)
  await u.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }))
  await u.upload(
    screen.getByLabelText('Chọn ảnh từ thiết bị'),
    new File(['synthetic image'], 'avatar.png', { type: 'image/png' }),
  )
  expect(screen.getByAltText('Xem trước ảnh đại diện')).toBeTruthy()
  await u.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(uploadAvatar).not.toHaveBeenCalled()
  expect(screen.queryByAltText('Xem trước ảnh đại diện')).toBeNull()
})
it('validates PIN mismatch, clears inputs and requires sign-in after successful own change', async () => {
  const u = userEvent.setup(),
    ended = vi.fn()
  render(
    <PersonalPage
      profile={profile}
      onExpenses={vi.fn()}
      onSessionEnded={ended}
    />,
  )
  await u.click(await screen.findByRole('button', { name: 'Đổi mã PIN' }))
  await u.type(screen.getByLabelText('Mã PIN hiện tại'), '123456')
  await u.type(screen.getByLabelText('Mã PIN mới'), '654321')
  await u.type(screen.getByLabelText('Xác nhận mã PIN mới'), '654320')
  await u.click(screen.getByRole('button', { name: 'Lưu mã PIN mới' }))
  expect((await screen.findByRole('alert')).textContent).toContain('chưa khớp')
  expect(api.changePin).not.toHaveBeenCalled()
  await u.clear(screen.getByLabelText('Xác nhận mã PIN mới'))
  await u.type(screen.getByLabelText('Xác nhận mã PIN mới'), '654321')
  await u.click(screen.getByRole('button', { name: 'Lưu mã PIN mới' }))
  await waitFor(() => expect(ended).toHaveBeenCalled())
  expect(screen.queryByLabelText('Mã PIN hiện tại')).toBeNull()
})
it.each(['MEMBER', 'PARENT'] as const)(
  '%s has privacy/received shares and the personal expense shortcut but no PIN recovery',
  async (role) => {
    const expenses = vi.fn()
    render(
      <PersonalPage
        profile={{ ...profile, role }}
        onExpenses={expenses}
      />,
    )
    expect(
      screen.getByText(
        'Dữ liệu Học tập, Rèn luyện, Thể trạng và Chi tiêu cá nhân mặc định là riêng tư.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Được chia sẻ với bạn' }),
    ).toBeTruthy()
    expect(screen.queryByText('Quản lý mã PIN gia đình')).toBeNull()
    const u = userEvent.setup()
    const shortcuts = screen.getAllByRole('button', {
      name: 'Mở chi tiêu cá nhân',
    })
    await u.click(shortcuts[shortcuts.length - 1])
    expect(expenses).toHaveBeenCalled()
  },
)
it('ADMIN recovery re-verifies own PIN and requires target-specific confirmation', async () => {
  const u = userEvent.setup()
  render(
    <PersonalPage
      profile={{ ...profile, role: 'ADMIN' }}
      onExpenses={vi.fn()}
    />,
  )
  await u.click(screen.getByRole('button', { name: 'Quản lý mã PIN gia đình' }))
  await screen.findByRole('option', { name: 'Synthetic Other' })
  await u.selectOptions(
    screen.getByLabelText('Thành viên cần đặt lại PIN'),
    '22222222-2222-4222-8222-222222222222',
  )
  await u.type(screen.getByLabelText('Mã PIN hiện tại của bạn'), '123456')
  await u.type(screen.getByLabelText('Mã PIN mới'), '654321')
  await u.type(screen.getByLabelText('Xác nhận mã PIN mới'), '654321')
  expect(
    (
      screen.getByRole('button', {
        name: 'Đặt lại mã PIN',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true)
  await u.click(
    screen.getByRole('checkbox', { name: /Tôi xác nhận.*Synthetic Other/ }),
  )
  await u.click(screen.getByRole('button', { name: 'Đặt lại mã PIN' }))
  await screen.findByText(/Đã đặt lại mã PIN.*Các phiên cũ/)
  expect(api.resetPin).toHaveBeenCalledWith(
    '22222222-2222-4222-8222-222222222222',
    {
      currentPin: '123456',
      newPin: '654321',
      confirmation: '654321',
      confirmReset: true,
    },
  )
  expect(screen.queryByLabelText('Mã PIN mới')).toBeNull()
})
it('settings loading failure offers retry and safe Vietnamese errors', async () => {
  vi.mocked(api.fetchSettings).mockRejectedValueOnce(new Error('secret detail'))
  const u = userEvent.setup()
  render(<PersonalPage profile={profile} onExpenses={vi.fn()} />)
  expect(screen.getByText('Đang mở hồ sơ…')).toBeTruthy()
  await u.click(
    await screen.findByRole('button', { name: 'Thử tải lại hồ sơ' }),
  )
  await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' })
  expect(screen.queryByText('secret detail')).toBeNull()
})
it('wrong current PIN shows safe error, clears sensitive input, and permits retry', async () => {
  vi.mocked(api.changePin).mockRejectedValueOnce(new api.ProfileApiError(401))
  const u = userEvent.setup()
  render(<PersonalPage profile={profile} onExpenses={vi.fn()} />)
  await u.click(await screen.findByRole('button', { name: 'Đổi mã PIN' }))
  for (const label of ['Mã PIN hiện tại', 'Mã PIN mới', 'Xác nhận mã PIN mới'])
    await u.type(screen.getByLabelText(label), '123456')
  await u.click(screen.getByRole('button', { name: 'Lưu mã PIN mới' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Chưa thể xác minh',
  )
  expect(
    (screen.getByLabelText('Mã PIN hiện tại') as HTMLInputElement).value,
  ).toBe('')
})
