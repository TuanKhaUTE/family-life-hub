import type { Request, Response } from 'express'

import { checkDatabaseConnection } from '../services/database-health.service.js'

export function getHealth(_request: Request, response: Response): void {
  response.status(200).json({ status: 'ok' })
}

export async function getDatabaseHealth(
  _request: Request,
  response: Response,
): Promise<void> {
  const isConnected = await checkDatabaseConnection()

  if (!isConnected) {
    response.status(503).json({ status: 'error', database: 'unavailable' })
    return
  }

  response.status(200).json({ status: 'ok', database: 'connected' })
}
