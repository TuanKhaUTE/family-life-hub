# AGENTS.md — Family Life Hub

## Project

Family Life Hub is a private family-oriented full-stack application. Keep the
codebase understandable, maintainable, and safe for real family data.

## Durable stack and architecture

- Frontend: React, Vite, and TypeScript.
- Backend: Node.js, Express, and TypeScript.
- Database: Supabase PostgreSQL.
- Package manager: npm.
- Request flow: React UI → REST API → Express backend → Supabase.
- The frontend must not query Supabase or domain database data directly.
- Keep frontend and backend code separated under `frontend/` and `backend/`.
- Keep database changes under `database/migrations/` and related database tests.

Read only documentation directly relevant to the current task. Do not preload
all canonical docs.

## Backend structure

Use clear boundaries when a responsibility exists:

Route → Controller → Service → Repository → Database

- Routes define endpoints and middleware wiring.
- Controllers translate HTTP input/output.
- Services contain application rules.
- Repositories contain database access.
- Do not put substantial business logic in route handlers.
- Do not create empty or speculative layers.

## Frontend structure

- Prefer feature-oriented organization.
- Keep domain components with their feature.
- Put reusable generic UI in shared component directories.
- Keep API calls, business rules, and large unrelated UI out of giant page
  components.
- Build mobile-first interfaces with comfortable touch targets.
- Vietnamese is the primary end-user UI language.

## Security and privacy

- Never store or log raw PINs.
- Never commit API keys, database credentials, service-role keys, tokens,
  secrets, or private family data.
- The backend must enforce roles, ownership, and privacy; frontend checks are
  not authorization.
- ADMIN is not unrestricted access to private member data.
- Treat private personal data as owner-scoped unless an explicit sharing rule
  allows access.
- Do not expose credentials, stack traces, or internal storage details in API
  responses.

## Scope and dependencies

- Implement only the requested scope.
- Do not add future features, speculative tables, placeholder modules, or
  unrelated UI.
- Before adding a dependency, confirm that it is necessary and prefer existing
  dependencies for simple needs.
- Prefer small functions, explicit types, predictable control flow, and clear
  names over clever abstractions or premature optimization.
- Comments should explain why non-obvious code exists.

## Database and API

- Use additive, ordered migrations for schema changes.
- Preserve existing data and avoid destructive operations unless explicitly
  requested and safely verified.
- Keep database behavior consistent with the relevant canonical data model.
- Use REST-style JSON APIs with consistent responses and server-side input
  validation.
- Use centralized error handling where it improves safe, predictable responses.

## Verification

- Write focused tests while implementing a change.
- Run the full relevant verification suite once at the end: lint, build,
  tests, and database checks when applicable.
- Run manual checks for user-facing changes and describe them in the handoff.
- Inspect the final diff and check for secrets, private data, generated files,
  and unrelated changes.
- Never claim a command or test was run unless it was actually run.

## Git and generated planning files

- Do not commit or push automatically; wait for explicit approval.
- Before requesting commit approval, report status, inspect the diff, and list
  relevant checks.
- Do not create Superpowers, specification, or planning files unless the user
  explicitly requests them.

## Documentation

When an established product, architecture, privacy, or design rule changes,
update the directly relevant canonical documentation in the same reviewed
change. Keep durable agent instructions concise; feature-specific behavior
belongs in canonical product, architecture, design, and database documents.

## Completion handoff

Report what changed, materially changed files, commands and results, known
limitations, manual test steps when relevant, and final Git status. Then stop
for review.
