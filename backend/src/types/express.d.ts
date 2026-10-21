import type { AuthenticatedFamilySession } from '../services/family-session.service.js'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedFamilySession
    }
  }
}

export {}
