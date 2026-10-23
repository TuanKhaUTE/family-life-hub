const MAX_INPUT_BYTES = 5 * 1024 * 1024
const SUPPORTED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class AvatarInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvatarInputError'
  }
}

export function normalizeAvatarImage(file: File): Promise<Blob> {
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

  const sourceUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const side = Math.min(image.naturalWidth, image.naturalHeight)
        if (!side) throw new AvatarInputError('Không thể đọc ảnh này.')
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const context = canvas.getContext('2d')
        if (!context) throw new AvatarInputError('Thiết bị chưa hỗ trợ xử lý ảnh.')
        const sourceX = (image.naturalWidth - side) / 2
        const sourceY = (image.naturalHeight - side) / 2
        context.drawImage(
          image,
          sourceX,
          sourceY,
          side,
          side,
          0,
          0,
          512,
          512,
        )
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new AvatarInputError('Không thể chuẩn hóa ảnh này.'))
          },
          'image/webp',
          0.84,
        )
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(sourceUrl)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl)
      reject(new AvatarInputError('Không thể đọc ảnh này.'))
    }
    image.src = sourceUrl
  })
}
