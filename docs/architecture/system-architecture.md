# Family Life Hub — System Architecture

## 1. Architecture Goal

Family Life Hub should be built as a clean full-stack application with clear boundaries between:

- user interface;
- backend API;
- business logic;
- persistence;
- authentication and authorization;
- notifications;
- analytics.

Although the initial application only serves a small family, the codebase should follow a maintainable structure suitable for a serious personal portfolio project.

The system must avoid unnecessary complexity while still demonstrating good software engineering practices.

---

# 2. High-Level Architecture

The application uses the following main stack:

Frontend:
- React
- Vite
- TypeScript

Backend:
- Node.js
- Express
- TypeScript

Database:
- PostgreSQL hosted by Supabase

Application format:
- Progressive Web App

Hosting:
- Vercel

Version control:
- GitHub

High-level request flow:

User Device
    |
    v
React PWA
    |
    | HTTPS / REST API
    v
Node.js + Express API
    |
    | Repository / Data Access Layer
    v
Supabase PostgreSQL

The frontend must not directly contain core business rules that belong to the backend.

---

# 3. Repository Structure

The project uses one Git repository with clearly separated application areas.

Planned root structure:

family-life-hub/
|
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- package.json
|   |-- tsconfig.json
|   `-- vite.config.ts
|
|-- backend/
|   |-- src/
|   |-- tests/
|   |-- package.json
|   `-- tsconfig.json
|
|-- database/
|   |-- migrations/
|   `-- seed/
|
|-- docs/
|   |-- requirements/
|   |-- architecture/
|   |-- design/
|   `-- database/
|
|-- postman/
|
|-- AGENTS.md
|-- .env.example
|-- .gitignore
`-- README.md

The frontend and backend are developed independently but remain inside the same repository.

---

# 4. Frontend Architecture

The frontend is responsible for:

- rendering the user interface;
- client-side routing;
- collecting user input;
- showing validation feedback;
- displaying API data;
- maintaining temporary UI state;
- installing and operating as a PWA;
- receiving supported push notifications.

The frontend must not be trusted to enforce security.

Authorization must always be verified by the backend.

---

## 4.1 Planned Frontend Structure

A feature-oriented structure is preferred.

Example:

frontend/src/
|
|-- app/
|   |-- router/
|   |-- providers/
|   `-- layout/
|
|-- components/
|   |-- ui/
|   `-- shared/
|
|-- features/
|   |-- auth/
|   |-- profile/
|   |-- meals/
|   |-- timetable/
|   |-- chores/
|   |-- notifications/
|   |-- wellness/
|   |-- fitness/
|   |-- study/
|   |-- expenses/
|   `-- gamification/
|
|-- hooks/
|-- lib/
|-- services/
|-- types/
|-- utils/
|-- assets/
|-- App.tsx
`-- main.tsx

Business-specific UI should live inside its corresponding feature folder.

Reusable generic components should live under:

components/ui/

or:

components/shared/

---

# 5. Backend Architecture

The backend owns:

- authentication;
- authorization;
- validation;
- business rules;
- database access;
- notifications;
- analytics calculations;
- privacy enforcement.

The backend follows a layered architecture.

Request flow:

Route
  |
  v
Controller
  |
  v
Service
  |
  v
Repository
  |
  v
PostgreSQL

Responsibilities must remain separated.

---

## 5.1 Backend Folder Structure

Planned structure:

backend/src/
|
|-- config/
|
|-- controllers/
|
|-- middleware/
|   |-- auth/
|   |-- authorization/
|   |-- validation/
|   `-- error/
|
|-- repositories/
|
|-- routes/
|
|-- services/
|
|-- validators/
|
|-- types/
|
|-- utils/
|
|-- app.ts
`-- server.ts

backend/tests/

Do not place business logic directly inside Express route handlers.

---

# 6. Layer Responsibilities

## 6.1 Routes

Routes define HTTP endpoints and connect middleware with controllers.

Example:

POST /api/auth/login

GET /api/meals

POST /api/meals/requests

PATCH /api/profile/me

Routes should remain small.

---

## 6.2 Controllers

Controllers translate HTTP requests into application operations.

Controllers should:

- extract request data;
- call the appropriate service;
- return HTTP responses.

Controllers should not contain complex business rules.

---

## 6.3 Services

Services contain application business logic.

Examples:

MealService

ScheduleService

NotificationService

ExpenseService

WellnessService

StudyService

Services decide what the application is allowed to do.

Example:

When Mom marks a meal as ready:

1. verify Mom has permission;
2. update meal status;
3. save the optional message;
4. create notifications;
5. request push delivery where supported.

---

## 6.4 Repositories

Repositories are responsible for database access.

Examples:

UserRepository

MealRepository

ScheduleRepository

ExpenseRepository

Repositories should contain database queries but not business decisions.

---

# 7. API Style

The backend should expose REST-style endpoints.

Base path:

/api

Examples:

/api/auth

/api/users

/api/meals

/api/timetables

/api/chores

/api/notifications

/api/wellness

/api/fitness

/api/study

/api/expenses

/api/achievements

API responses should use consistent JSON structures.

Detailed endpoint design will be created feature by feature rather than defining the entire API prematurely.

`GET /api/home` is an authenticated, read-only composition of existing breakfast, today's dinner request/final meal, and rating data. Existing services retain deadline and ownership rules. Home explicitly projects compact DTOs; members receive only their own response states, PARENT receives family response states. Recent ready dinner dishes expose family average/count and only the actor's individual score, never other members' comments or rating identities. The session middleware rejects inactive/expired sessions. Responses are not cached. Home adds no future-module persistence, schema changes, or database writes.

Feature 3B adds calendar composition to Home using the same CalendarService as Lịch. It returns at most three non-cancelled ongoing/upcoming events today: all active owners for PARENT, only the actor for ADMIN/MEMBER. Calendar visibility is intentionally family-shared and does not change privacy defaults for other modules.

Authenticated calendar APIs follow Route → Controller → Service → Repository → Database: `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&memberId=UUID` (inclusive range, up to 31 days; optional member filter), `POST /api/calendar/events`, `PUT /api/calendar/events/:eventId`, `DELETE /api/calendar/events/:eventId`, and `PUT /api/calendar/events/:eventId/occurrences/:date`. Mutation bodies cannot supply actor/owner identity. Full event updates and occurrence overrides are distinct. Service-only RPCs recheck active ownership and serialize series/exception writes with event-row locks. Recurrence expansion lives in the database read RPC rather than being duplicated on the client. No calendar/meal automation, push, external sync, or private-module reads are introduced.

---

# 8. Authentication Architecture

Family Life Hub does not use public registration.

Family members are created in advance.

Login flow:

Family profile selection
        |
        v
Enter 6-digit PIN
        |
        v
POST /api/auth/login
        |
        v
Backend verifies profile and PIN
        |
        v
Authenticated session
        |
        v
Application dashboard

The user-facing login does not require email addresses.

---

## 8.1 PIN Storage

PIN values must never be stored as plain text.

The backend must hash PINs using an appropriate password hashing algorithm.

The database stores only the hash.

Authentication comparison occurs on the backend.

Initial PINs may use a family member's birthday in DDMMYY format because the application is private and intended for family use.

Users can later change their PIN.

Feature 6B settings follow Route → Controller → Service → Repository. Session identity is the only actor: `GET/PUT /api/profile/me` read/update own display name and preset avatar; `POST /api/profile/me/pin` verifies the current PIN before rotation. ADMIN-only `GET /api/profile/members` and `POST /api/profile/members/:memberId/pin-reset` recover another active member after re-verifying the administrator's own PIN and explicit confirmation. These actions never grant private module access.

Rotation updates the Argon2id hash and PIN-change timestamp, clears target lockout, and revokes **all** target sessions atomically. Own change clears the current cookie and returns to profile selection; ADMIN reset preserves the administrator's sessions. Current-PIN failures obey the existing five-attempt/15-minute lock. Login completion, failure recording, session creation, and rotation use verified-hash comparisons under a shared transaction advisory lock, preventing an in-flight old-PIN login from recreating a revoked session. RPCs are backend-only, SECURITY INVOKER, with fixed empty search paths. Raw PIN input is retained only as required, never deliberately persisted/logged; JavaScript memory reclamation is not a secure wipe.

---

## 8.2 Authentication Session

Authentication should be handled by the backend.

Authentication uses an opaque server-managed session token in the `family_session` cookie.

The backend stores only the token's SHA-256 hash. Session tokens expire after a fixed seven days and are not refreshed on use.

The cookie is HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production. The raw token must not appear in JSON responses, URLs, or logs.

Protected backend routes use centralized authentication middleware to require an unexpired session belonging to an active family member. Logout deletes only the presented session and clears its cookie.

Sensitive authentication data must not be exposed in URLs.

Authentication code must be centralized rather than duplicated across features.

---

# 9. Authorization Model

Authorization uses more than roles.

The system combines:

- role-based access;
- resource ownership;
- privacy settings.

This is important because ADMIN does not mean unrestricted access to every personal record.

---

## 9.1 Role-Based Authorization

Initial roles:

ADMIN

PARENT

MEMBER

Roles determine system capabilities.

Example:

PARENT may create meal requests.

MEMBER may respond to meal requests.

ADMIN may manage family accounts.

---

## 9.2 Ownership Authorization

Some resources belong to individual users.

Example:

Bin owns Bin's timetable.

Therefore:

Bin:
read + edit

Mom:
read

Kha:
read

Kha's ADMIN role does not automatically grant timetable edit permission.

---

## 9.3 Privacy Authorization

Sensitive personal modules are private by default.

Examples:

- wellness;
- fitness;
- study;
- grades;
- personal expenses.

A record can only be read by:

- its owner;
- explicitly permitted users;
- users permitted through a sharing policy.

ADMIN status must not automatically bypass these rules.

---

# 10. Privacy Model

Privacy should support two levels.

## Module Default

Example:

Wellness visibility:
Only me

Study visibility:
Only me

---

## Record Override

Feature 6A implements explicit record sharing through a separate Route → Controller → ShareService → SupabaseShareRepository → restricted SECURITY INVOKER RPC boundary. Existing session middleware protects GET `/api/shares?resourceType=STUDY_ASSESSMENT&resourceId=UUID` (owner's eligible recipients/current grants), POST `/api/shares` (resourceType/resourceId/recipientMemberId only), DELETE `/api/shares/:id` (owner revoke), and GET `/api/shares/received?page=1` (session recipient only, 20 rows/page). Actor IDs never come from request payloads. Private Study, Fitness, Wellness and personal-expense services/RPCs remain unchanged; received records cannot be used to access a source workspace.

Sharing has a typed source FK with ownership and cascade deletion, idempotent uniqueness, default-deny RLS and backend-only SELECT/INSERT/DELETE grants. Create/revoke reuse Study's per-owner lock. Dedicated reads project only owner display/avatar, course name and assessment result/date/share timestamp, with derived percentage; source IDs, notes, weights and unrelated records are excluded. Repository and frontend reconstruct whitelisted DTOs. Responses and requests use no-store. Active status is checked on every read; revoked/deleted sources disappear on next refresh. Frontend sharing lives in its own feature, invoked from assessment cards and Cá nhân, not Home. No public lookup, generic unrestricted resource reader, notifications or future resource types are added.

A specific record may override the module default.

Example:

Study module:
Private

Midterm result:
Shared with Mom

The backend must enforce visibility.

The frontend hiding a button or page is not sufficient security.

---

# 11. Database Architecture

Supabase PostgreSQL provides the relational database.

The application backend is the primary application layer between the frontend and database.

Database design should favor:

- normalized relational data;
- foreign keys;
- timestamps;
- ownership fields;
- clear domain boundaries;
- migration scripts;
- seed data.

Database changes must be represented through migration files rather than undocumented manual changes.

A detailed database specification will be maintained separately under:

docs/database/

---

# 12. Main Data Domains

The database will eventually contain entities related to the following domains.

## Identity

Family members

Profiles

Roles

Authentication credentials

Preferences

---

## Meals

Breakfast catalog

Meal requests

Meal request options

Meal responses

Meals

Meal dishes

Dish categories

Ratings

Comments

---

## Timetable

Semesters

Subjects

Weekly schedules

Class sessions

Schedule exceptions

---

## Chores

Feature 3C uses Route → Controller → ChoreService → SupabaseChoreRepository → restricted database RPCs. Session middleware supplies the actor; client role/member fields never authorize a write. PARENT manages, every active member reads, and only the assignee completes their own dated occurrence. No parent override or ADMIN management bypass exists.

REST endpoints:

- `GET /api/chores?from=YYYY-MM-DD&to=YYYY-MM-DD&memberId=UUID` (optional member filter; maximum inclusive 31 days).
- `POST /api/chores/schedules` creates a one-time or weekly schedule with a stable client UUID `requestId` retry key.
- `PUT /api/chores/schedules/:id` edits/reassigns the existing schedule atomically.
- `DELETE /api/chores/schedules/:id` soft-cancels the schedule, retaining completion history.
- `POST /api/chores/schedules/:id/occurrences/:date/complete` records self-completion with an empty JSON body.
- `POST /api/chores/schedules/:id/occurrences/:date/cancel` cancels one pending occurrence (PARENT only).

Weekly rules are explicit ISO weekday/member mappings with optional end date, expanded on reads using the existing family-time convention. Separate per-date snapshots preserve completion/cancellation and assignee history. Atomic service_role-only, SECURITY INVOKER RPCs validate actor/assignee rules, serialize mutation retries, and update assignment notifications without resetting `read_at`. Browser database roles have no grants/policies. No schedulers, realtime, or push are introduced.

Lịch mounts a feature-owned ChoresSection below the normal timeline. Home composes ChoreService data into at most three safe non-cancelled summaries today: family-wide for PARENT, own-only for ADMIN/MEMBER. Frontend requests go through Express and use the existing session; successful schedule mutations refresh the existing notification bell via `family-notifications-changed`.

---

## Notifications

In-app notifications

Notification recipients

Read status

Push subscriptions

---

## Wellness

Feature 4D follows Route → Controller → WellnessService → SupabaseWellnessRepository → restricted SECURITY INVOKER RPCs, using existing session middleware. `GET /api/wellness` returns the actor's profile, latest 14 weight logs, and derived summary. `PUT /api/wellness/profile` sets optional height/target/activity; `DELETE /api/wellness/profile` resets only profile settings, preserving logs. `POST /api/wellness/logs`, `PUT /api/wellness/logs/:id`, and `DELETE /api/wellness/logs/:id` manage own measurements. Duplicate dates return an actionable conflict, never silently overwrite.

Service and RPCs independently require active ADMIN/MEMBER. PARENT is denied and ADMIN cannot bypass ownership. Client owner fields are rejected on updates and never authorize reads. Missing/foreign log IDs have identical errors. Default-deny RLS and service_role-only grants exclude browser access. A profile's PK is its owner FK; logs reference the same family member directly and remain independent of optional profile existence. Per-owner advisory locks serialize writes; triggers enforce valid active owners and immutable identities.

The repository reconstructs whitelisted DTOs and validates measurements. It reads at most 31 latest unique daily logs so the service can calculate exact observed 7/30-day windows even though only 14 history rows reach the client. The service uses centralized family-local today, derives current/previous change, observed spans/counts, and BMI when height exists; no derived data is stored. Windows are today plus the previous 6/29 dates; two actual observations are required. Created/updated timestamps remain UTC. No sensitive demographic attributes are inferred or added, so BMR/TDEE remain deferred.

Feature-owned frontend Thể trạng is nested within Rèn luyện with independent loading/error/retry and compact profile/log forms. It uses Express only and a bounded observation list, without chart dependencies. Home never invokes Wellness or returns its data for any role. There is no sharing, family calendar write, workout-goal adjustment, notification, background job, or medical-advice engine.

---

## Fitness

Feature 4C follows Route → Controller → FitnessService → SupabaseFitnessRepository → restricted SECURITY INVOKER RPCs. Existing session middleware protects all routes. `GET /api/fitness` returns only the actor's plans, plan days, goals, latest 20 completed sessions, and weekly summary. `POST /api/fitness/:kind`, `PUT /api/fitness/:kind/:id`, and `DELETE /api/fitness/:kind/:id` support `plans`, `days`, `goals`, and `sessions`. Full update bodies accept editable fields only, never owner identity. Active plan/goal switching is a normal update.

The service and RPCs independently require active ADMIN/MEMBER. PARENT is denied; ADMIN has no ownership bypass. Reads and mutations are actor-scoped; foreign/missing IDs share the same not-found response. Composite owner/entity foreign keys prevent cross-owner links. Per-owner advisory locks make mutations and active-plan/goal switching atomic. Tables use default-deny RLS and service_role-only grants; browser roles cannot access the tables or RPCs. Referenced plans/days require explicit unlinking/deletion of dependencies, rather than cascading private workout history away.

The backend supplies the family-local current date using centralized family time. `performed_at` is a completed family-local date; created/updated timestamps are UTC. Monday–Sunday totals include all weekly sessions independently of the recent-list cap. Durations may be unknown; summaries include known minutes and an unknown-duration count. Next workout scans the active weekly schedule from today, skipping a plan day already completed on the matching date. No calendar synchronization or background job is introduced.

Home calls FitnessService only for ADMIN/MEMBER and projects weekly counts, target, percentage, known minutes, and unknown-duration count. It excludes plan names, next-workout details, notes, and history; PARENT receives no Fitness property or database read. The feature-oriented frontend uses Express only, preserves Study/grades, and adds compact sibling Home cards without chart dependencies. There are no Fitness notifications, sharing, exercise details, or wellness metrics.

---

## Study

Feature 4A follows Route → Controller → StudyService → SupabaseStudyRepository → restricted SECURITY INVOKER RPCs. `GET /api/study` returns the actor's own semesters, courses, goals, latest 50 sessions, and current-week summary. `POST /api/study/:kind`, `PUT /api/study/:kind/:id`, and `DELETE /api/study/:kind/:id` support `semesters`, `courses`, `goals`, and `sessions`. Full update bodies contain only editable fields; no actor/owner field is accepted. Goal completion is a normal update to COMPLETED. Queries cannot select another member's workspace.

Existing session middleware rejects inactive/expired sessions. StudyService rejects PARENT; RPCs independently require active ADMIN/MEMBER, scope every read/mutation to the authenticated actor, and return the same not-found response for foreign/missing IDs. Composite owner/entity foreign keys prohibit cross-owner semester/course links. Per-owner advisory locks make active-semester switching atomic. Restricted table grants and default-deny RLS prevent browser access; no sharing policies exist.

Session `studied_at` is a family-local date, not an automatic calendar event. Created/updated timestamps are UTC. The backend supplies today's date from centralized family time; weekly totals run Monday–Sunday and do not depend on the bounded recent-session list. Goal time progress uses current-week minutes, course-filtered when linked. Home calls StudyService only for ADMIN/MEMBER and explicitly projects own totals/active goals, omitting Study entirely for PARENT. There is no Study notification, background job, chart dependency, or calendar write.

Feature 4B extends these same Study boundaries: `GET /api/study/assessments?courseId=UUID` lists own grades, courses, and derived course summaries; the course filter is optional and cannot select a foreign course. `POST /api/study/assessments`, `PUT /api/study/assessments/:id`, and `DELETE /api/study/assessments/:id` reuse the Study controller/service/repository with separate restricted assessment RPCs. Mutation bodies cannot supply ownership or a stored percentage. The service validates scores/weights and computes honest averages/weighted coverage; the database rechecks role, ownership, composite course FK, and constraints. Missing/foreign IDs have the same error response. Home's existing own-only Study projection adds one compact latest result without notes/history; PARENT does not invoke the Study/grade reads. The frontend grades view is feature-owned and uses Express only, with no heavy chart library or new notifications.

Academic semesters

Subjects

Study goals

Study sessions

Assessments

Grades

---

## Expenses

Feature 5A follows Route → Controller → PersonalExpenseService → SupabasePersonalExpenseRepository → restricted SECURITY INVOKER RPCs. Existing session middleware protects `GET/POST /api/expenses/personal` and `PUT/DELETE /api/expenses/personal/:id`. GET accepts optional `month=YYYY-MM` (default family-local current month) and `page` (default 1, 20 rows/page); month/page and all mutation fields are validated server-side. There is no owner selector, and the backend session actor alone authorizes access for all three roles. No ADMIN/PARENT bypass or sharing exists.

One personal-expenses table uses bigint VND, immutable owner FK, constraints, default-deny RLS, and backend-only grants. RPCs independently check active ownership, serialize mutations with per-owner advisory locks, and return identical missing/foreign-ID errors. Monthly/previous-month sums and category totals are calculated across all matching records independently of pagination. Currency travels as canonical integer strings; monetary arithmetic uses BigInt. Only the rounded dimensionless percentage is converted to Number, with null for a zero baseline or unrepresentable ratio.

Home calls the personal-expense service with the signed-in profile for every role and explicitly projects only own month/currency/totals/comparison. It never includes expense records, notes, categories, or another member's spending. Feature-oriented frontend ExpensePage/PersonalExpenses owns the forms and API calls. Mom's Chi tiêu has Cá nhân plus a functional shared Tiền ăn gia đình tab (Feature 5B); other members enter from Cá nhân. Internal subviews preserve the approved five-item navigation. Home exposes an explicitly separate shared food summary and shortcut for all roles, never personal totals presented as family spending.

Feature 5B implements household food expenses as a separate shared domain. Feature 5A creates no shared food records, conversion, budgets, bank integration, notification, or background job.

Feature 5B shared food spending uses Route → Controller → FamilyFoodService → SupabaseFamilyFoodRepository → restricted SECURITY INVOKER RPCs, not the personal-expense repository. Existing session middleware protects GET/POST `/api/expenses/family-food` and PUT/DELETE `/:id`; GET accepts month/page (20 entries/page). Shared GET `/slot?mealDate=&mealType=` reads one meal; PARENT-only GET `/prefill?mealDate=&mealType=` suggests editable names only. Service and database both enforce PARENT-only management. One unique date/type header and its 1–30 items update atomically under a transaction advisory lock. Default-deny RLS and backend-only grants forbid browser table/RPC access. Names/prices are independent snapshots; no meal/rating history is changed. Home explicitly projects a separate shared compact summary. Bếp performs independent read-only cost requests for today's breakfast/dinner; no expense forms or direct Supabase queries are added there. No expense notifications are emitted.

---

## Gamification

Achievements

Achievement definitions

User achievement records

Statistics used for badges

---

# 13. Meal Architecture

Meals require special handling because breakfast differs from lunch and dinner.

---

## 13.1 Breakfast

Breakfast is system-driven.

The application provides a recurring daily selection using the breakfast catalog.

Initial breakfast dishes:

- Cơm tấm
- Bún chả
- Miến gà
- Bún thịt nướng
- Phở
- Bún riêu
- Bún bò
- Bánh cuốn
- Bánh mì
- Trứng ốp la + bánh mì sandwich + thịt nguội + xúc xích
- Mì gói
- Bánh canh cua
- Other / Custom
- Not eating

The system must distinguish:

NO_RESPONSE

from:

NOT_EATING

These states must never be inferred from one another.

The implemented breakfast API is backend-only and session-protected:

- `GET /api/breakfast/catalog` returns active catalog choices;
- `GET /api/breakfast/days/:date` returns the authorized view for a family date (or `next`);
- `PUT /api/breakfast/days/:date/response` creates or replaces only the signed-in member's response;
- `PUT /api/breakfast/days/:date/purchase` lets an active `PARENT` confirm purchase and add or update an optional message.

`PARENT` profiles receive active non-parent response statuses and do not submit a breakfast response for themselves. `ADMIN` and `MEMBER` profiles receive and change only their own response. Role alone never grants write access to another member's response.

Breakfast dates and the midnight deadline are interpreted centrally in `Asia/Ho_Chi_Minh`; persisted timestamps remain UTC instants. The frontend consumes these endpoints through the Express API and does not query Supabase directly.

Purchase confirmation uses one restricted database operation to upsert the date-level purchase and one notification per active `ADMIN` or `MEMBER`. The purchase/date identity and notification event key make repeated requests idempotent; editing Mom's message updates the existing purchase and notification text without changing read state.

---

## 13.2 Lunch and Dinner

Lunch and dinner are parent-driven.

Mom may create:

OPEN_CHOICE

or:

OPTION_POLL

OPEN_CHOICE allows Kha and Bin to propose dishes.

OPTION_POLL allows Mom to define available choices.

Mom later confirms the actual final meal.

The implemented Feature 2C API keeps this workflow behind the backend:

- `GET /api/meals/requests/current` returns only today's non-cancelled DINNER plan in family time, with only the signed-in member's response unless the viewer is the parent; parent responses include deduplicated `candidates` derived from active non-parent responses;
- `POST /api/meals/requests` creates one parent-owned request per date and meal type;
- `PATCH /api/meals/requests/:id` lets the parent edit the complete plan (mode, deadline, options, note) or cancel it using the same request ID;
- `PUT /api/meals/requests/:id/response` saves only the signed-in non-parent member's response.

The backend derives the actor from the session. Restricted database functions make request creation, notification fan-out, same-row plan changes, request updates, and response upserts atomic. A meal request keeps the same identity when the parent changes self-service into an interactive plan. An elapsed deadline is treated as closed even before a stored status update occurs. Browser database roles have no direct access to these tables or functions.

Feature 2F uses `configure_meal_request` to serialize edits with response saves. `confirmResponseReset` is required when a committed edit would discard incompatible responses; without confirmation, the API returns `MEAL_RESPONSE_RESET_REQUIRED`. Compatible responses and unchanged poll option IDs are retained. Cancellation stores `CANCELLED`, retains history, and updates the existing request-status notification without resetting `read_at`. A cancelled slot can be reconfigured through the same row; a compatible POST retry can also reuse it. Expiry never implies cancellation.

---

## 13.3 Final Meal

A final meal may contain multiple dishes.

Example:

Dinner

- Gà chiên nước mắm
- Thịt kho
- Canh chua

Each dish can have a category.

Example categories:

MAIN

SOUP

SIDE

VEGETABLE

OTHER

The application does not calculate precise portion percentages.

Feature 2D stores actual lunch/dinner dishes in `final_meals` and `final_meal_dishes` through session-protected APIs:

- `GET /api/meals/final/:date/:type` reads a slot (`LUNCH` or `DINNER`), returning `meal: null` if none exists;
- `PUT /api/meals/final/:date/:type` lets an active parent save or replace the ordered dish list;
- `PUT /api/meals/final/:date/:type/ready` marks the saved meal ready or updates its optional message.

Routes, controllers, services, and repositories retain their existing responsibilities. Session context supplies the actor; `ADMIN` has no parent write permissions. Restricted `SECURITY INVOKER` database functions atomically reconcile dishes and fan out ready notifications. Reads return dish IDs; saves carry retained IDs, update their rows, create ID-less entries, and delete only omitted dishes. Same-meal ownership and distinct IDs are checked inside the transaction, and deferrable order uniqueness allows swaps without replacing dishes. Existing ratings therefore survive edits to retained dishes. Slot locking and database constraints prevent duplicate meals, mismatched request links, empty finalized meals, and contradictory self-service/cooked states. Child responses remain unchanged.

The first ready action sets a UTC `ready_at` timestamp and creates one `MEAL_READY` notification per active non-parent member. Retries and message edits reuse the same notification identity, preserve `read_at`, and retain the original ready time. Browser roles cannot access these tables or RPCs directly. The UI formats time in the family timezone using Vietnamese locale.

Feature 2G narrows the normal frontend to next breakfast and today's dinner without date selectors. Date-capable technical APIs and lunch history remain compatible. Finalization uses the parent's response-derived candidates with an optional manual extra, through the existing final-meal REST save. Ready composition is checked in the service and by a service-only, fixed-search-path SECURITY INVOKER database trigger; row locks serialize dish changes with readiness. Ready messages remain editable. The optional explicit-confirmation create RPC overload safely reuses a cancelled slot with incompatible old responses, without changing the legacy RPC contract. Ratings reuse the existing REST backend inside a focused portal sheet with keyboard containment and focus restoration.

---

# 14. Rating Architecture

Ratings belong to individual dishes served in a specific meal.

They do not belong only to the generic dish name.

This allows:

"Gà chiên nước mắm on Monday"

to receive a different rating from:

"Gà chiên nước mắm on Friday"

A rating contains:

- author;
- meal dish;
- rating score;
- optional comment;
- timestamp.

Historical ratings may later be aggregated by dish.

Feature 2E exposes session-protected `GET /api/meals/final/:mealId/ratings` and `PUT /api/meals/dishes/:dishId/rating` through route/controller/service/repository boundaries. The write accepts only `rating` and optional `comment`; the session supplies ownership, never a body member ID. Restricted database RPCs enforce active-member/ready-meal rules and atomically upsert the unique member/dish rating. Reads return only the member's feedback, or named per-dish feedback for PARENT. The frontend uses only REST, and calculates a small per-dish average/count for the parent's view; no global statistics or new notifications are introduced.

---

# 15. Notification Architecture

Notifications have two layers.

## In-App Notification

Stored permanently in the database.

Contains:

- recipient;
- notification type;
- message;
- related resource;
- created time;
- read status.

The implemented notification API is session-protected:

- `GET /api/notifications` lists only the signed-in member's notifications, newest first;
- `PATCH /api/notifications/:id/read` marks a notification read only when it belongs to the signed-in member.

The authenticated header bell consumes these endpoints. The list response includes an exact owner-scoped `unreadCount` independently of its newest-50-item list. Notifications open in a dismissible sheet, with mark-read actions updating the badge; a zero count renders no badge. The frontend never queries notification tables directly.

---

## Push Notification

Optional real-time delivery to installed PWA devices.

A push notification does not replace the database notification.

If push delivery fails, the in-app notification remains available.

---

## 15.1 Notification Events

Possible events include:

BREAKFAST_PURCHASED

MEAL_REQUEST_STATUS

MEAL_READY

MEAL_DEADLINE_REMINDER

CHORE_UPDATED

Future modules may create additional events.

---

# 16. Scheduled Operations

Some functionality may eventually require scheduled execution.

Example:

- breakfast availability;
- meal deadline reminders;
- recurring statistics.

Scheduled functionality should be isolated from normal request handling.

The implementation mechanism may use Vercel scheduling or another suitable scheduler depending on the available free-tier capabilities at implementation time.

Scheduled infrastructure should not be added until a feature actually requires it.

---

# 17. PWA Architecture

The React frontend should eventually support Progressive Web App capabilities.

Planned PWA responsibilities include:

- web app manifest;
- installable application metadata;
- application icons;
- service worker;
- basic caching strategy;
- push subscription support.

PWA functionality should be introduced incrementally rather than during initial project scaffolding.

---

## 17.1 Offline Behavior

The application does not need to become fully offline-first.

A reasonable goal is:

- application shell may remain available;
- previously cached static assets may load;
- network-dependent actions clearly indicate when connectivity is unavailable.

Operations requiring current server data should not pretend to succeed while offline unless an explicit synchronization feature is later implemented.

---

# 18. Analytics Architecture

Analytics should normally be calculated from existing application records.

Examples:

Meal analytics:
- average ratings;
- popular dishes.

Study analytics:
- study hours by week.

Wellness analytics:
- weight trend.

Expense analytics:
- monthly totals;
- category breakdown;
- month-over-month difference.

Avoid storing derived values unnecessarily when they can be reliably calculated from source records.

---

# 19. Gamification Architecture

Gamification should consume existing domain activity rather than control business logic.

Example:

Meal responses
        |
        v
Achievement evaluator
        |
        v
"Loyal Customer"

Gamification must never be required for core application features to function.

Achievements should remain positive.

Sensitive data must not be exposed through leaderboards.

---

# 20. Expense Separation

Household food expenses and personal expenses are separate domains.

## Household Food Expense

Managed primarily by Mom.

Used to understand household food spending.

---

## Personal Expense

Owned by an individual user.

Private by default.

Example:

Kha cannot automatically see Bin's personal spending.

Bin cannot automatically see Kha's personal spending.

ADMIN does not bypass this privacy rule.

---

# 21. Error Handling

The backend should use centralized error handling.

Errors should follow a consistent format.

Example:

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid meal selection"
  }
}

Production responses should not expose:

- stack traces;
- database credentials;
- internal implementation details.

---

# 22. Validation

Input validation must exist on both sides for different purposes.

Frontend validation:

Improves user experience.

Backend validation:

Protects application integrity.

Backend validation is authoritative.

Inputs requiring validation include:

- PIN;
- display name;
- meal selections;
- ratings;
- comments;
- dates;
- times;
- weight;
- study duration;
- monetary values.

---

# 23. Environment Configuration

Secrets and environment-specific values must be stored in environment variables.

Possible variables include:

Backend:

DATABASE_URL

SUPABASE_URL

SUPABASE_SERVICE_ROLE_KEY

AUTH_SECRET

FRONTEND_ORIGIN

Future push notifications:

VAPID_PUBLIC_KEY

VAPID_PRIVATE_KEY

Frontend should only receive variables explicitly safe for browser exposure.

No real secret may be committed to Git.

The repository should provide:

.env.example

files containing variable names without secret values.

---

# 24. Deployment Architecture

Target production environment:

Vercel

Database:

Supabase

Source:

GitHub

The deployment architecture should support:

GitHub push
    |
    v
Vercel deployment
    |
    +--> React frontend
    |
    `--> Backend API

The exact Vercel project/rewrite arrangement should be finalized when deployment is implemented.

The preferred outcome is a simple user experience where the frontend communicates with the backend through a stable production API path.

---

# 25. Development Environments

Development:

Local React application

Local Node.js API

Remote or local-development Supabase project

Production:

Vercel

Supabase production project

Development and production configuration must remain separate.

---

# 26. Testing Strategy

Testing should be introduced gradually.

Backend priorities:

- service tests;
- authorization tests;
- validation tests;
- API integration tests.

Frontend priorities:

- important interaction tests;
- form behavior;
- critical user flows.

Manual testing remains required before each feature commit.

---

# 27. API Testing

A Postman collection should eventually be maintained under:

postman/

It should cover important backend APIs such as:

- authentication;
- meals;
- schedules;
- expenses.

Postman artifacts should evolve as APIs are implemented.

---

# 28. Security Principles

The project should follow these minimum principles:

1. Never trust frontend authorization.
2. Never store raw PINs.
3. Never commit secrets.
4. Validate server-side input.
5. Enforce ownership server-side.
6. Enforce privacy server-side.
7. Restrict CORS to expected application origins.
8. Rate-limit sensitive endpoints where appropriate.
9. Avoid exposing internal errors.
10. Minimize access to private personal data.

Security measures should remain appropriate to the application rather than adding unnecessary enterprise complexity.

---

# 29. Incremental Development Rule

Architecture must not be implemented all at once.

Each feature should introduce only the architecture it actually requires.

Example:

Project foundation:
- basic frontend;
- basic backend;
- health endpoint.

Authentication feature:
- account repository;
- authentication service;
- authentication controller;
- authentication middleware.

Meal feature:
- meal repository;
- meal service;
- meal controller.

Avoid generating empty domain classes or placeholder services for every future feature during initial scaffolding.

---

# 30. Architectural Decision Philosophy

When choosing between two approaches:

Prefer the solution that is:

1. understandable;
2. maintainable;
3. testable;
4. secure enough for the data involved;
5. appropriate for a small real-world family application;
6. easy for Kha to explain in a portfolio or interview.

Avoid adding technology only because it appears more advanced.

Every dependency should have a clear purpose.
