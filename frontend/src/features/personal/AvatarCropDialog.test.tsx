import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AvatarCropDialog } from './AvatarCropDialog'
import * as imageApi from './avatar-image'

vi.mock('./avatar-image', async () => {
  const actual = await vi.importActual<typeof import('./avatar-image')>(
    './avatar-image',
  )
  return {
    ...actual,
    loadAvatarImage: vi.fn(async () => ({
      image: { naturalWidth: 1200, naturalHeight: 800 },
      sourceUrl: 'blob:crop-source',
    })),
    renderAvatarCrop: vi.fn(async () =>
      new Blob(['cropped'], { type: 'image/webp' }),
    ),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const file = new File(['source'], 'avatar.png', { type: 'image/png' })

it('confirms a pan and zoom crop as a WebP avatar', async () => {
  const u = userEvent.setup(),
    onCancel = vi.fn(),
    onConfirm = vi.fn()
  render(
    <AvatarCropDialog file={file} onCancel={onCancel} onConfirm={onConfirm} />,
  )
  await screen.findByRole('dialog', { name: 'Chỉnh ảnh đại diện' })
  const zoom = screen.getByLabelText('Thu phóng ảnh')
  expect((zoom as HTMLInputElement).max).toBe('5')
  fireEvent.change(zoom, { target: { value: '1.8' } })
  const workspace = screen.getByTestId('avatar-crop-workspace')
  fireEvent.pointerDown(workspace, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(workspace, { pointerId: 1, clientX: 140, clientY: 80 })
  fireEvent.pointerUp(workspace, { pointerId: 1 })
  await u.click(screen.getByRole('button', { name: 'Dùng ảnh này' }))
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.any(Blob)))
  expect(imageApi.renderAvatarCrop).toHaveBeenCalledWith(
    expect.objectContaining({ sourceUrl: 'blob:crop-source' }),
    expect.objectContaining({ zoom: 1.8, offsetX: 40, offsetY: -20 }),
  )
  expect(onCancel).not.toHaveBeenCalled()
})

it('uses the full square workspace as the final circular avatar frame', async () => {
  render(
    <AvatarCropDialog file={file} onCancel={vi.fn()} onConfirm={vi.fn()} />,
  )
  await screen.findByRole('dialog', { name: 'Chỉnh ảnh đại diện' })
  const guide = document.querySelector('.avatar-crop-guide') as HTMLElement
  expect(guide.style.inset).toBe('0')
})

it('cancels without producing an avatar and closes on Escape', async () => {
  const u = userEvent.setup(),
    onCancel = vi.fn(),
    onConfirm = vi.fn()
  render(
    <AvatarCropDialog file={file} onCancel={onCancel} onConfirm={onConfirm} />,
  )
  await screen.findByRole('dialog', { name: 'Chỉnh ảnh đại diện' })
  await u.keyboard('{Escape}')
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

it('shows a safe error when image validation throws synchronously', async () => {
  const u = userEvent.setup(),
    onCancel = vi.fn(),
    onConfirm = vi.fn()
  vi.mocked(imageApi.loadAvatarImage).mockImplementationOnce(() => {
    throw new imageApi.AvatarInputError('Ảnh đại diện không hợp lệ.')
  })
  render(
    <AvatarCropDialog file={file} onCancel={onCancel} onConfirm={onConfirm} />,
  )
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Ảnh đại diện không hợp lệ.',
  )
  await u.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})
