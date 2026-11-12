# Vercel deployment

Family Life Hub is deployed as one Vercel project from the repository root.
The frontend build is emitted from `frontend/dist`, while the catch-all
function in `api/[...path].ts` exposes the existing Express app under `/api/*`.
The browser keeps using relative `/api/...` requests, so production does not
need a hardcoded API URL and the PWA assets remain on the same origin.

## Vercel project settings

- Root Directory: repository root (`.`)
- Framework Preset: Other (the checked-in `vercel.json` supplies the build)
- Build Command: `npm run build`
- Output Directory: `frontend/dist`
- Install Command: `npm install`
- Node.js Version: 22.x (the root `package.json` requires Node 22.12+)

The API function is `/api/[...path].ts`; it imports `backend/src/app.ts` and
never starts a listener. `/api/*` is intentionally excluded from the SPA
fallback, so API errors cannot be replaced by `index.html`.

## Required Vercel environment variables

Set these for Production, Preview, and Development as appropriate. Values are
entered in the Vercel dashboard and are never committed here:

- `SUPABASE_URL` — the configured Supabase project URL.
- `SUPABASE_SECRET_KEY` — the server-only Supabase secret/service-role key.
- `FRONTEND_ORIGIN` — the exact deployed browser origin, for example
  `https://family-life-hub.example.com` (no trailing path).

`PORT` is only a local-development setting. `BACKEND_URL` is only the local
Vite proxy target and is not used by the production bundle. Vercel supplies
`NODE_ENV=production`, which keeps the existing session cookie HttpOnly,
SameSite=Lax, Secure, Path=/, and seven days in duration.

## First deployment and smoke test

1. Import the repository into Vercel as one project using the settings above.
2. Add the three required environment variables before the first production
   deployment.
3. Deploy and open `https://<production-origin>/api/health`; it must return
   `{ "status": "ok" }`.
4. Open the production origin in a private browser window, confirm the PWA
   manifest/service worker load, select a profile, and complete a normal login.
5. Confirm browser requests remain same-origin `/api/...` requests and that
   logout/account switching does not reveal another member's data.

The service worker caches only the app shell and static assets. It bypasses
`/api/*`, so authenticated API responses are never treated as offline truth.
