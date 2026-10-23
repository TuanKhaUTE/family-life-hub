import type { ErrorRequestHandler } from 'express'

import { ApiError } from '../errors/api-error.js'

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    })
    return
  }

  if (isJsonParseError(error)) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body must be valid JSON',
      },
    })
    return
  }

  if (isEntityTooLargeError(error)) {
    response.status(413).json({
      error: {
        code: 'AVATAR_TOO_LARGE',
        message: 'Ảnh đại diện cần nhỏ hơn 5 MB. Vui lòng chọn ảnh khác.',
      },
    })
    return
  }

  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error',
    },
  })
}

function isJsonParseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as Record<string, unknown>

  return candidate.status === 400 && candidate.type === 'entity.parse.failed'
}

function isEntityTooLargeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as Record<string, unknown>
  return candidate.status === 413 && candidate.type === 'entity.too.large'
}
