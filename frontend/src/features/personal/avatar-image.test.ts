import { afterEach, expect, it, vi } from 'vitest'
import {
  normalizeAvatarImage,
  renderAvatarCrop,
  type AvatarCropSource,
} from './avatar-image'

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

it('center-crops a portrait source without distortion', async () => {
  const drawImage = vi.fn(),
    toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob(['normalized'], { type: 'image/webp' })),
    ),
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob,
    }
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:portrait'),
    revokeObjectURL: vi.fn(),
  })
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 800
      naturalHeight = 1200
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
  await normalizeAvatarImage(
    new File(['source'], 'portrait.png', { type: 'image/png' }),
  )
  expect(drawImage).toHaveBeenCalledWith(
    expect.anything(),
    0,
    200,
    800,
    800,
    0,
    0,
    512,
    512,
  )
  createElement.mockRestore()
})

it('applies pan and zoom to the square crop output', async () => {
  const drawImage = vi.fn(),
    toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob(['normalized'], { type: 'image/webp' })),
    ),
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob,
    }
  vi.spyOn(document, 'createElement').mockReturnValue(
    canvas as unknown as HTMLElement,
  )
  const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement,
    source = { image, sourceUrl: 'blob:source' } as AvatarCropSource
  await renderAvatarCrop(source, {
    offsetX: 70,
    offsetY: -20,
    zoom: 2,
    viewportSize: 280,
  })
  const args = drawImage.mock.calls[0] as unknown[]
  expect(args[1]).toBeCloseTo(300)
  expect(args[2]).toBeCloseTo(228.57, 1)
  expect(args[3]).toBeCloseTo(400)
  expect(args[4]).toBeCloseTo(400)
  expect(args[5]).toBe(0)
  expect(args[6]).toBe(0)
  expect(args[7]).toBe(512)
  expect(args[8]).toBe(512)
})

it('keeps a zoomed portrait crop covered while panning toward the face', async () => {
  const drawImage = vi.fn(),
    toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob(['normalized'], { type: 'image/webp' })),
    ),
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob,
    }
  vi.spyOn(document, 'createElement').mockReturnValue(
    canvas as unknown as HTMLElement,
  )
  const source = {
    image: { naturalWidth: 800, naturalHeight: 2400 },
    sourceUrl: 'blob:portrait-full-body',
  } as AvatarCropSource

  await renderAvatarCrop(source, {
    offsetX: 0,
    offsetY: 1000,
    zoom: 4.5,
    viewportSize: 280,
  })

  const args = drawImage.mock.calls[0] as unknown[]
  expect(args[2]).toBeCloseTo(476.19, 1)
  expect(args[3]).toBeCloseTo(177.78, 1)
  expect(args[4]).toBeCloseTo(177.78, 1)
  expect(args[2]).toBeGreaterThanOrEqual(0)
  expect((args[2] as number) + (args[4] as number)).toBeLessThanOrEqual(2400)
  expect(canvas.width).toBe(512)
  expect(canvas.height).toBe(512)
})

it('clamps extreme landscape panning so the square output never exposes blank pixels', async () => {
  const drawImage = vi.fn(),
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback) =>
        callback(new Blob(['normalized'], { type: 'image/webp' })),
      ),
    }
  vi.spyOn(document, 'createElement').mockReturnValue(
    canvas as unknown as HTMLElement,
  )
  const source = {
    image: { naturalWidth: 2400, naturalHeight: 800 },
    sourceUrl: 'blob:landscape',
  } as AvatarCropSource

  await renderAvatarCrop(source, {
    offsetX: 99999,
    offsetY: -99999,
    zoom: 5,
    viewportSize: 280,
  })

  const args = drawImage.mock.calls[0] as unknown[],
    sourceX = args[1] as number,
    sourceY = args[2] as number,
    sourceWidth = args[3] as number,
    sourceHeight = args[4] as number
  expect(sourceX).toBeGreaterThanOrEqual(0)
  expect(sourceY).toBeGreaterThanOrEqual(0)
  expect(sourceX + sourceWidth).toBeLessThanOrEqual(2400)
  expect(sourceY + sourceHeight).toBeLessThanOrEqual(800)
})
