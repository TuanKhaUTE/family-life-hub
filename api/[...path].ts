/// <reference path="../backend/src/types/express.d.ts" />

import app from '../backend/src/app.js'

// Vercel owns the HTTP server in production. Keep server.ts for local
// development, and expose the same Express app without calling listen here.
export default app
