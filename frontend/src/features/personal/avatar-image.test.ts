import { afterEach, expect, it, vi } from 'vitest'
import { normalizeAvatarImage } from './avatar-image'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('rejects an oversized source photo before decoding it', () => {
  const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
    type: 'image/png',
  })
  expect(() => normalizeAvatarImage(file)).toThrow('nhỏ hơn 5 MB')
})

it('rejects unsupported source formats before decoding them', () => {
  const file = new File(['synthetic'], 'avatar.gif', { type: 'image/gif' })
  expect(() => normalizeAvatarImage(file)).toThrow('JPEG, PNG hoặc WebP')
})

it('center-crops and emits a 512px WebP avatar', async () => {
  const createObjectURL = vi.fn(() => 'blob:source'),
    revokeObjectURL = vi.fn(),
    drawImage = vi.fn(),
    toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob(['normalized'], { type: 'image/webp' })),
    ),
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob,
    }
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 1200
      naturalHeight = 800
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
  const createElement = vi
    .spyOn(document, 'createElement')
    .mockReturnValue(canvas as unknown as HTMLElement)
  const result = await normalizeAvatarImage(
    new File(['source'], 'avatar.png', { type: 'image/png' }),
  )
  expect(result.type).toBe('image/webp')
  expect(canvas.width).toBe(512)
  expect(canvas.height).toBe(512)
  expect(drawImage).toHaveBeenCalledWith(
    expect.anything(),
    200,
    0,
    800,
    800,
    0,
    0,
    512,
    512,
  )
  expect(createObjectURL).toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:source')
  createElement.mockRestore()
})
