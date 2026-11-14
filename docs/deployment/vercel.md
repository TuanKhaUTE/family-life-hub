# Vercel deployment

Family Life Hub is deployed as one Vercel project with two Vercel Services:

- `frontend` — the Vite app rooted at `frontend/`, publicly serving the SPA.
- `backend` — the Express app rooted at `backend/`, publicly exposed only
  through `/api` rewrites.

The browser keeps using relative `/api/...` requests, so production does not
need a hardcoded API URL and the PWA assets remain on the same origin. The
backend receives the original request path, including `/api`; for example,
`/api/auth/profiles` reaches the existing Express app at that same path.

## Vercel project settings

- Framework Preset: Services
- Project Root Directory: repository root (`.`)
- Service configuration: the checked-in `vercel.json` owns each service's
  root, framework, build command, and output directory.
- Node.js Version: 22.x for both services.

The Express service entrypoint is `backend/src/app.ts`; it exports the app and
does not start a listener. `backend/src/server.ts` remains for local
development only. There is no competing root `api/[...path].ts` function.

## Required Vercel environment variables

Set these for Production, Preview, and Development as appropriate. Values are
entered in the Vercel dashboard and are never committed here:

- `SUPABASE_URL` — the configured Supabase project URL.
- `SUPABASE_SECRET_KEY` — the server-only Supabase secret/service-role key.
- `FRONTEND_ORIGIN` — the exact deployed browser origin, for example
  `https://family-life-hub.example.com` (no trailing path).

Vercel Services use project-level environment variables shared by the service
build/runtime contexts; the Services configuration does not provide a
service-specific dashboard scope. Add the variables at the project level for
the required environments, keep `SUPABASE_SECRET_KEY` unprefixed (never
`VITE_`), and do not reference it from frontend code. Vite only exposes
client variables explicitly prefixed for the browser, so the secret remains
server-only at runtime and is never embedded in the frontend bundle. If strict
build-context isolation is required, deploy the backend as a separate Vercel
project instead of using one Services deployment.

`PORT` is only a local-development setting. `BACKEND_URL` is only the local
Vite proxy target and is not used by the production bundle. Vercel supplies
`NODE_ENV=production`, which keeps the existing session cookie HttpOnly,
SameSite=Lax, Secure, Path=/, and seven days in duration.

## First deployment and smoke test

1. Import the repository into Vercel as one project and select the **Services**
   framework/preset. Do not use Application Preset Other for this deployment.
2. Add the three required environment variables before the first production
   deployment.
3. Deploy and open `https://<production-origin>/api/health`; it must return
   `{ "status": "ok" }`. Also verify nested routes such as
   `/api/auth/profiles` and `/api/auth/me` reach Express (the latter returns a
   JSON `401` without a session).
4. Open the production origin in a private browser window, confirm the PWA
   manifest/service worker load, select a profile, and complete a normal login.
5. Confirm browser requests remain same-origin `/api/...` requests and that
   logout/account switching does not reveal another member's data.

The service worker caches only the app shell and static assets. It bypasses
`/api/*`, so authenticated API responses are never treated as offline truth.
