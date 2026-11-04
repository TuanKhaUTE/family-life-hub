const MAX_INPUT_BYTES = 5 * 1024 * 1024
const OUTPUT_SIZE = 512
const DEFAULT_VIEWPORT_SIZE = 280
const SUPPORTED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class AvatarInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvatarInputError'
  }
}

export interface AvatarCropSource {
  image: HTMLImageElement
  sourceUrl: string
}

export interface AvatarCrop {
  offsetX: number
  offsetY: number
  zoom: number
  viewportSize: number
}

export function loadAvatarImage(file: File): Promise<AvatarCropSource> {
  validateAvatarFile(file)
  const sourceUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(sourceUrl)
        reject(new AvatarInputError('Không thể đọc ảnh này.'))
        return
      }
      resolve({ image, sourceUrl })
    }
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl)
      reject(new AvatarInputError('Không thể đọc ảnh này.'))
    }
    image.src = sourceUrl
  })
}

export function releaseAvatarImage(source: AvatarCropSource) {
  URL.revokeObjectURL(source.sourceUrl)
}

export function normalizeAvatarImage(file: File): Promise<Blob> {
  const sourcePromise = loadAvatarImage(file)
  return sourcePromise.then(async (source) => {
    try {
      return await renderAvatarCrop(source, {
        offsetX: 0,
        offsetY: 0,
        zoom: 1,
        viewportSize: DEFAULT_VIEWPORT_SIZE,
      })
    } finally {
      releaseAvatarImage(source)
    }
  })
}

export function renderAvatarCrop(
  source: AvatarCropSource,
  crop: AvatarCrop,
): Promise<Blob> {
  const width = source.image.naturalWidth,
    height = source.image.naturalHeight,
    viewportSize =
      crop.viewportSize > 0 ? crop.viewportSize : DEFAULT_VIEWPORT_SIZE,
    zoom = Math.max(1, crop.zoom),
    scale = Math.max(viewportSize / width, viewportSize / height) * zoom,
    side = viewportSize / scale,
    centerX = width / 2 - crop.offsetX / scale,
    centerY = height / 2 - crop.offsetY / scale,
    sourceX = clamp(centerX - side / 2, 0, width - side),
    sourceY = clamp(centerY - side / 2, 0, height - side)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    return Promise.reject(
      new AvatarInputError('Thiết bị chưa hỗ trợ xử lý ảnh.'),
    )
  }
  context.drawImage(
    source.image,
    sourceX,
    sourceY,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new AvatarInputError('Không thể chuẩn hóa ảnh này.'))
      },
      'image/webp',
      0.84,
    )
  })
}

function validateAvatarFile(file: File) {
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarInputError(
      'Ảnh đại diện cần nhỏ hơn 5 MB. Vui lòng chọn ảnh khác.',
    )
  }
  if (!SUPPORTED_INPUT_TYPES.has(file.type.toLowerCase())) {
    throw new AvatarInputError(
      'Vui lòng chọn ảnh JPEG, PNG hoặc WebP để làm ảnh đại diện.',
    )
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
