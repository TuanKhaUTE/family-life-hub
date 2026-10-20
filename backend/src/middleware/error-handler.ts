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
