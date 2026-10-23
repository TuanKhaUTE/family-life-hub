# Family Life Hub — Initial Data Model

## 1. Purpose

This document defines the initial conceptual database model for Family Life Hub.

It is not a final migration schema.

Tables should be implemented incrementally as their corresponding features are developed.

Do not create every table during initial project scaffolding.

---

# 2. Identity Domain

## family_members

Represents a family account.

Suggested fields:

id

display_name

role

avatar_type

avatar_value

`avatar_type` is null for initials, `EMOJI` for a predefined choice, or
`IMAGE` for an owner-uploaded avatar. For `IMAGE`, `avatar_value` stores only
the backend avatar route with a cache-busting version; image bytes live in the
dedicated public-read/service-write Supabase Storage bucket. Uploads are
normalized to WebP before storage and are always bound to the session owner.

is_active

created_at

updated_at

Initial roles:

ADMIN

PARENT

MEMBER

---

## auth_credentials

Stores authentication information separately from public profile information.

Suggested fields:

member_id

pin_hash

pin_changed_at

failed_attempt_count

locked_until

updated_at

Raw PIN values must never be stored.

---

## auth_sessions

Stores opaque backend authentication sessions separately from profile and PIN credentials.

Implemented fields:

id

member_id

token_hash

expires_at

created_at

`member_id` references `family_members` with cascading deletion. Only a SHA-256 session-token hash is stored; raw tokens remain in HttpOnly browser cookies. Multiple concurrent sessions per member are allowed.

---

# 3. Privacy Domain

## module_privacy_settings

Future conceptual model only; Feature 6A does not create or enable module-wide privacy settings.

Stores default sharing preferences for private modules.

Suggested fields:

id

owner_id

module

visibility

created_at

updated_at

Possible modules:

WELLNESS

FITNESS

STUDY

GRADES

PERSONAL_EXPENSES

---

## private_record_shares (Feature 6A)

Migration: `20261022150000_create_private_record_shares.sql`. UUID `id`; owner_member_id FK (RESTRICT); recipient_member_id FK (CASCADE); resource_type (only STUDY_ASSESSMENT); resource_id UUID; UTC created_at. Self-sharing is forbidden; owner/recipient/type/resource is unique. Receipt/date/id and owner/type/resource indexes support bounded reads. Permissions are always read-only; there is no arbitrary permission column.

A conditional generated assessment_id equals resource_id only for STUDY_ASSESSMENT. Its composite FK (owner_member_id, assessment_id) references a new unique (owner_member_id,id) constraint on study_assessments, with CASCADE deletion. This enforces real source ownership and removes shares safely when the source is deleted. Future resource types require explicit migration, typed source references and safe projection code; no future types are enabled now.

Default-deny RLS has no browser policies. PUBLIC/anon/authenticated have no table/RPC privileges; service_role has SELECT/INSERT/DELETE only (not UPDATE). The guard requires an active ADMIN/MEMBER owner and a different active recipient. SECURITY INVOKER RPCs have fixed empty search paths and qualified tables: private_share_create/owner/revoke/received. Writes reuse the per-owner Study transaction lock and never weaken private Study reads. Duplicate create preserves share identity/timestamp. Foreign/missing sources or revoke targets have identical not-found responses.

Received reads join only the session recipient's explicit shares to active owners and owned assessments/courses. They return 20-row pages plus total count and only the approved safe projection, excluding notes, weight, source/course/owner IDs and unrelated private data. The service derives percentage. Revocation is visible on the next request; no stale server/client caching. Owner reads return eligible active family profiles and existing recipient grants for that single owned source, including inactive former recipients so owners can revoke them. Verification: `database/tests/private-shares.rollback.sql`.

---

# 4. Meal Domain

## dishes

Reusable dish catalog.

Implemented fields:

id

name

created_by

is_active

created_at

updated_at

This table may include both breakfast catalog dishes and reusable household dishes.

---

## breakfast_catalog

Controls which dishes appear in recurring breakfast selection.

Implemented fields:

dish_id

display_order

is_active

created_at

updated_at

Initial breakfast catalog:

Cơm tấm

Bún chả

Miến gà

Bún thịt nướng

Phở

Bún riêu

Bún bò

Bánh cuốn

Bánh mì

Trứng ốp la + bánh mì sandwich + thịt nguội + xúc xích

Mì gói

Bánh canh cua

Custom and Not Eating are application states and do not necessarily need to be stored as normal dishes.

---

## breakfast_selections

Stores daily breakfast answers.

Implemented fields:

id

member_id

breakfast_date

selection_type

dish_id

custom_dish_name

created_at

updated_at

Possible selection types:

SELECTED

CUSTOM

NOT_EATING

No database row may represent NO_RESPONSE.

NO_RESPONSE is determined by absence of a response.

Correction Batch A adds service-only SECURITY INVOKER guards for the family-time window D-1 18:00 through (exclusive) D 01:00, active non-parent ownership and post-purchase locking. Selection/purchase writes serialize by breakfast date. The purchase/UI lifecycle never deletes selection history.

---

## breakfast_purchases

Stores the single current purchase confirmation for a breakfast date.

Implemented fields:

id

breakfast_date

confirmed_by_member_id

message

purchased_at

created_at

updated_at

`breakfast_date` is unique. Reconfirming a date updates the existing record rather than creating another purchase event.

---

## meal_requests

Parent-created lunch or dinner request.

Implemented fields:

id

created_by_member_id

meal_date

meal_type

mode

parent_message

deadline_at

status

created_at

updated_at

Meal types:

LUNCH

DINNER

Request types:

OPEN_CHOICE

OPTION_POLL

Possible statuses:

OPEN

CLOSED

SELF_SERVICE

CANCELLED

There is one request per `(meal_date, meal_type)`. Interactive requests require a mode and deadline. Self-service requests store neither. Whole-plan edits atomically reuse the same row. Unchanged poll labels retain their option IDs, so compatible selections and NOT_EATING responses remain valid. Incompatible responses are removed only with explicit parent confirmation, checked inside the transaction. Changing to self-service invalidates every response.

Cancellation retains the request, its mode/options/deadline and responses for history, but blocks new responses. The parent can reconfigure the same slot afterward. Expiry remains a closed read state and is not cancellation. RLS is enabled with no browser policies; only the backend service role has table access.

Feature 2G excludes CANCELLED, lunch and non-current-cycle plans from active kitchen lookup without deleting history or changing meal-type constraints. Correction Batch C1 adds `ensure_recurring_dinner` and `set_dinner_suggestion`: the backend materializes one OPEN dinner row for the current D-1 18:00–D 01:00 family-time cycle, and parent suggestion edits reuse that row. The normal dinner UI does not create daily requests. A service-only eight-argument `create_meal_request` overload accepts explicit confirmation before discarding incompatible historical responses on slot reuse; the original seven-argument RPC remains compatible. Compatible responses and notification `read_at` remain intact.

---

## meal_request_options

Used for OPTION_POLL.

Retained for legacy compatibility; new dinner UI/API creation uses free-text OPEN_CHOICE, not new poll options. Active historical dinner polls can accept CUSTOM responses without removing old option rows.

Implemented fields:

id

meal_request_id

label

sort_order

created_at

---

## meal_responses

Stores Kha or Bin's response.

Implemented fields:

id

meal_request_id

member_id

response_type

option_id

custom_text

created_at

updated_at

Possible response types:

SELECTED_OPTION

CUSTOM

NOT_EATING

There is at most one response per member and request. A composite foreign key ensures a selected option belongs to the same request. `NO_RESPONSE` is represented by the absence of a row and is never converted to `NOT_EATING`.

---

## final_meals

Represents the actual lunch or dinner finalized by an active parent (Feature 2D).

Implemented fields:

id

meal_date

meal_type

meal_request_id (optional)

finalized_by_member_id

ready_message

ready_at

created_at

updated_at

One row per `(meal_date, meal_type)`. A composite foreign key ensures an optional request has the same slot. A meal may also be finalized without a request. A self-service slot must explicitly change plans first. `ready_at` is null while preparing and is set once when the parent marks the meal ready; message updates preserve that timestamp. Finalization does not change family responses.

After readiness, `guard_ready_meal_composition` prevents dish inserts, updates and deletes, and prevents resetting readiness or changing the slot. Message-only updates remain valid. Preparing dish identities still survive reconciliation. The guard uses meal-row locks, SECURITY INVOKER, a fixed search path and no browser execute privileges. Parent-meal deletion still cascades for database integrity; no meal deletion API is introduced.

---

## final_meal_dishes

Individual dishes contained inside a final meal.

Implemented fields:

id

final_meal_id

name

category

sort_order

Categories:

MAIN

SOUP

SIDE

VEGETABLE

OTHER

Names must be trimmed and nonblank (up to 120 characters). Every finalized save has 1–30 dishes with explicit zero-based order. API reads include each saved dish's UUID. The atomic save updates retained IDs in place (including renames, category changes and reordering), inserts entries without IDs, and deletes only omitted dishes. Supplied IDs must be distinct and belong to that same final meal. The order uniqueness constraint is deferred during the save to allow swaps and checked before returning. A deferred constraint prevents a committed final meal from having no dishes; the dish foreign key prevents orphans and cascades with a deleted meal. Both tables have RLS enabled, no browser policies, and backend `service_role` access only.

---

## final_meal_dish_ratings

Rating for a specific meal dish.

Implemented fields: `id`, `final_meal_dish_id`, `member_id`, `rating`, optional `comment`, `created_at`, `updated_at`.

The score is an integer from 1–5. Comments are trimmed, nonblank when stored, and at most 300 characters; blank input becomes null. A unique `(final_meal_dish_id, member_id)` constraint makes saves update the same rating. Dish and member foreign keys cascade on deletion; deleting a final meal cascades through its dishes. Dishes keep their identity during preparation edits, then their composition is locked once ready so existing ratings stay attached to the same served dishes. The foreign keys retain cascading integrity for technical parent-record deletion, without exposing a meal/rating deletion UI.

Only active ADMIN/MEMBER actors may rate a ready meal. A database guard checks active role and readiness, and prohibits moving a rating to another member or dish. Service-only `SECURITY INVOKER` RPCs use a fixed empty search path. RLS is enabled with no browser policies; PUBLIC, anon, and authenticated have no table or function access. Backend sessions supply the actor. Members read only their own feedback; an active PARENT reads named feedback grouped by dish, but cannot rate.

Home additionally exposes family rating averages/counts for up to three recent ready dinner dish instances, with only the signed-in member's own individual score. This read-only backend projection does not expose another member's score, comment, or identity, and does not change table grants, RLS, or the feedback API's ownership rules. No Home-specific tables are needed.

---

# 5. Timetable Domain

## Implemented family calendar (Feature 3B)

Correction Batch B reuses `calendar_events` with explicit `calendar_type` FAMILY/PERSONAL (default FAMILY for new legacy writes). Existing child-owned events are conservatively backfilled PERSONAL; all PARENT events remain FAMILY, including retained inactive-parent history. During the locked migration only, existing owner/update-timestamp triggers are paused for that type-only backfill and restored before commit, preserving original timestamps. Inactive owners remain hidden until reactivation. A visibility trigger rejects new PARENT personal events. Both old/new `calendar_read` signatures enforce privacy; the new signature adds type and rejects foreign PERSONAL filters. Legacy save updates retain type unless the owner explicitly changes it. Correction Batch C1 links private Study/Fitness plans to dated PERSONAL events and keeps planned activity out of family calendar reads.

Week-copy provenance columns `copied_from_event_id`, `copied_from_date`, `copy_target_week` have a unique index with owner identity. Provenance is retained as an identity snapshot, not a cascading foreign key. `calendar_duplicate_week` expands only owned FAMILY source occurrences, skips cancelled entries and recurring instances already in the next week, creates concrete next-week rows atomically and deduplicates retries. Source edits do not overwrite saved copies. All new functions remain service_role-only SECURITY INVOKER with empty search paths.

`calendar_events` contains UUID `id`, `owner_member_id` (family-member FK), trimmed `title` (1–120 characters), `category`, UTC `starts_at` / `ends_at`, optional trimmed `note` (1–1000 characters), nullable integer-array `weekdays` (distinct ISO weekdays 1–7), optional `recurrence_until`, and created/updated timestamps. Null weekdays means one-time. Weekly anchor dates and times use `Asia/Ho_Chi_Minh`, with same-day start/end and optional inclusive end date. Times must be finite, ordered, and at most 31 days apart; supported family dates are 2000–2199. Categories: SCHOOL, WORK, FITNESS, FAMILY, APPOINTMENT, PERSONAL, OTHER.

`calendar_occurrence_exceptions` uses `(event_id, occurrence_date)` as its primary key, with a cascading event FK. The date identifies the original recurring occurrence, even if moved. A cancelled row has no override fields. A non-cancelled row has its own title, UTC start/end, nullable note, and timestamps. Retry updates reuse the same exception. Triggers validate that the original date belongs to an active owner's weekly series. Series scheduling changes with existing exceptions fail rather than deleting or orphaning those exceptions.

Both tables have default-deny RLS, no browser policies, and no PUBLIC/anon/authenticated privileges. Service-role-only SECURITY INVOKER functions use a fixed empty search path. Backend session actors are checked for activity and ownership inside mutation RPCs. Family reads omit inactive owners and project safe profiles only. Bounded reads expand at most 31 family dates and include moved exceptions based on their effective interval, not just their original date. Home uses these same reads without writing calendar data.

## personal_activity_plans (Correction Batch C1)

`personal_activity_plans` links one owner-owned dated PERSONAL `calendar_events` row to a `STUDY` or `FITNESS` plan. It stores optional same-owner `course_id` for Study, `completed_at`, and `cancelled`; the calendar event remains the source of title, UTC start/end, and note. A completed plan links to exactly one existing `study_sessions` or `fitness_sessions` actual row through `activity_plan_id`, preserving legacy history and making retries idempotent. Planned rows do not count as progress; progress is derived from actual sessions with today/week/month comparisons and scheduled on-time consistency. Guard triggers keep identity, owner, kind, privacy, due-time edits, and cross-domain links safe. The activity tables and RPCs use default-deny RLS, no browser grants, service-role-only SECURITY INVOKER functions with an empty search path, and owner-scoped reads; PARENT and other members cannot read another owner's plans.

The following academic-semester tables are future conceptual models, not part of Feature 3B.

## academic_semesters

Suggested fields:

id

owner_id

name

start_date

end_date

is_active

created_at

updated_at

Example:

Semester 1 — 2027

---

## subjects

Suggested fields:

id

semester_id

name

code

created_at

updated_at

---

## class_sessions

Represents actual class sessions.

Suggested fields:

id

subject_id

owner_id

session_date

start_time

end_time

location

status

notes

created_at

updated_at

Possible status:

SCHEDULED

CANCELLED

MOVED

---

Weekly duplication should create or derive future sessions without granting edit access to other members.

---

# 6. Chore Domain

## Active combined household duty (Correction Batch B)

`household_duties` uses DATE `duty_date` as its primary key (one Rửa chén & Đổ rác assignment/day), unique UUID `id`, active-assignee FK, scheduling-PARENT FK, `cancelled`, nullable UTC `completed_at` / completed-by FK, and UTC created/updated timestamps. Completion requires both fields, completed-by equals assignee, and cancellation is incompatible with completion. Triggers retain immutable identity and completion facts. Completed rows cannot be reassigned or cancelled.

Restricted `household_duty_read`, `household_duty_save_week`, `household_duty_duplicate_week`, and `household_duty_action` enforce active actors and roles inside the database. Week saves contain up to seven unique dated assignments and are atomic. Copies take a Monday source date, copy non-cancelled assignments forward seven days without completion facts, skip identical targets and abort on differing/cancelled targets. A shared transaction lock serializes mutations. Completion is assignee-only on today's Asia/Ho_Chi_Minh date, idempotent and atomically emits `HOUSEHOLD_DUTY_COMPLETED` to the active scheduling PARENT with resource type HOUSEHOLD_DUTY and the duty UUID. Conflict handling preserves `read_at`; no sibling/admin notification is emitted.

RLS is enabled without browser policies; PUBLIC/anon/authenticated have no table or function privileges. Service-role invoker functions use fixed empty search paths and qualified relations. Legacy generic chore tables below remain intact as historical data and are not automatically merged or shown as new combined duties. Rollback-only coverage: `database/tests/correction-batch-b.rollback.sql`.

## Implemented family chores (Feature 3C)

- `chore_schedules`: UUID `id`, unique UUID `request_key` for create retries, trimmed `title` (1–120 characters), `category` (DISHES/TRASH/CLEANING/SHOPPING/LAUNDRY/OTHER), `scheduled_date`, nullable local minute-precision `scheduled_time`, nullable `assigned_member_id`, `is_weekly`, nullable `recurrence_until`, nullable trimmed `note` (up to 1000 characters), `created_by_member_id`, `cancelled`, UTC `created_at`/`updated_at`.
- `chore_weekly_assignments`: composite primary key `(schedule_id, weekday)` with ISO weekday 1–7 and `assigned_member_id`. One-time schedules require a direct assignee; weekly schedules use explicit weekday assignments instead. Assignees must be active when configured.
- `chore_occurrences`: composite primary key `(schedule_id, occurrence_date)`, snapshot `assigned_member_id`, persisted status COMPLETED or CANCELLED, nullable `completed_at`/`completed_by_member_id`, and UTC timestamps. PENDING is derived by absence of an occurrence row. COMPLETED requires both completion fields and the completing member must equal the assignee; CANCELLED has neither. Schedule and member relationships use foreign keys.

Reads expand weekly rules within an inclusive range of at most 31 days in the centralized family timezone; supported dates are 2000–2199. Persisted completion/cancellation snapshots remain visible after rule changes and preserve their assignee. There is no scheduled row generation. Cancelling a schedule retains completed history and makes pending occurrences cancelled; it is not a hard delete.

Session-authenticated REST endpoints invoke fixed-search-path, SECURITY INVOKER RPCs with the session actor. Active PARENT manages schedules, all active members read, and only the actual assignee completes today/past occurrences. Create retries, weekday replacement, assignment notifications, and completion metadata are atomic/idempotent. Duplicate create keys with different content conflict instead of overwriting.

All three tables have RLS enabled, no browser policies, and PUBLIC/anon/authenticated privileges revoked. Only backend service_role has the required table/RPC privileges. `CHORE_ASSIGNMENT` notifications use `(recipient, type, CHORE_SCHEDULE, schedule_id)` identity, update text without resetting `read_at`, and never create daily reminder jobs.

---

# 7. Notification Domain

## notifications

Implemented fields:

id

recipient_member_id

type

title

message

related_resource_type

related_resource_id

related_date

created_at

read_at

Notifications use an event identity across recipient, type, related resource type, and related resource ID. Breakfast purchase retries reuse their event identity. Lunch and dinner request states use the stable `MEAL_REQUEST_STATUS` type, so mode and status changes update one current notification per recipient and request while preserving `read_at`. A null `read_at` means unread.

The implemented tables use default-deny RLS and are available only through the backend service role. The Express API enforces recipient ownership.

Notification viewing acknowledges shown items through an owner-scoped `read_at IS NULL` conditional update; retries preserve the first non-null read timestamp and unread totals include hidden rows.

---

## push_subscriptions

Suggested fields:

id

member_id

endpoint

subscription_data

created_at

updated_at

Push subscriptions should be managed securely.

---

# 8. Wellness Domain

## wellness_profiles

Feature 4D migration: `20261022120000_create_private_wellness.sql`.

`owner_member_id` is the primary key/FK to `family_members`, with RESTRICT. Optional `height_cm` is 100–250; optional `target_weight_kg` is 20–350. Numeric values must equal their two-decimal rounding, rather than silently rounding invalid input. Optional `activity_level` is SEDENTARY/LIGHT/MODERATE/ACTIVE/VERY_ACTIVE. `updated_at` is a UTC timestamp maintained by the shared update trigger. An absent profile or null fields never invent defaults.

## wellness_weight_logs

UUID `id` primary key; `owner_member_id` FK to `family_members` with RESTRICT; family-local `logged_date` between 2000 and 2199, not future; required numeric `weight_kg` (20–350, at most two decimals); optional trimmed `note` (1–1000 characters); UTC `created_at`/`updated_at`. Unique `(owner_member_id, logged_date)` enforces one daily measurement and supports scoped chronological reads. Date conflicts are rejected on insert and update, not upserted. Profile reset never cascades to logs.

Both tables enable default-deny RLS with no browser policies. PUBLIC/anon/authenticated grants are revoked; only backend service_role receives CRUD and function execute. Triggers require active ADMIN/MEMBER owners and immutable ownership/row identity. PARENT has no workspace. Restricted SECURITY INVOKER functions `wellness_read(actor, today)` and `wellness_mutate(actor, kind, id, input, remove)` have fixed empty search paths and qualified relations. Actor identity comes from the backend session, not editable JSON. Every mutation/read is owner-scoped; foreign and missing log IDs produce the same not-found response. Profile writes upsert only the actor's own row. Per-owner advisory locks serialize writes.

Read RPC returns the own profile and latest 31 dated measurements; the service derives summaries and returns only the latest 14 history rows. Daily uniqueness means 31 rows contain every possible observation within a 30-day window. Current/previous measurements, signed changes, observed 7/30-day trends, and optional BMI are computed by the service, never stored. No birthday/age/biological-sex fields, BMR/TDEE, sharing tables, or calorie tracking are added. Rollback-only verification lives in `database/tests/wellness.rollback.sql`.

---

# 9. Fitness Domain

## Implemented private foundation (Feature 4C)

Migration: `20261022110000_create_private_fitness.sql`.

All four tables have UUID primary keys, `owner_member_id` referencing `family_members` with RESTRICT, and UTC `created_at`/`updated_at` timestamps. Triggers require an active ADMIN/MEMBER owner, prevent owner/identity changes, and maintain update timestamps. PARENT has no workspace. No role bypasses ownership.

- `fitness_plans`: trimmed `name` (1–120 characters), optional trimmed `note` (1–1000), `is_active`. A partial unique index permits at most one active plan per owner.
- `fitness_plan_days`: `plan_id`, ISO `weekday` (1–7), trimmed `title` (1–120), optional note. Unique `(plan_id, weekday)` keeps one workout per weekday. Composite `(owner_member_id, plan_id)` FK prevents cross-owner links.
- `fitness_goals`: integer `weekly_session_target` (1–21), `is_active`. A partial unique index permits at most one active goal per owner. No goal means no default target.
- `fitness_sessions`: optional `plan_day_id`, family-local `performed_at` date (2000–2199, not future), trimmed title, optional integer `duration_minutes` (1–1440), optional note. Every row represents a completed workout; no redundant completed flag. Composite `(owner_member_id, plan_day_id)` FK prevents cross-owner links. Title/note are session snapshots, not live plan-day titles.

Plan/day FKs use RESTRICT: explicitly unlink or delete dependent records before deleting a referenced plan/day. There is no cascading loss of workout history. Owner/date indexes support recent sessions; unique owner/entity keys support composite FKs.

All tables enable default-deny RLS without browser policies. PUBLIC/anon/authenticated privileges are revoked on tables and Fitness functions; only backend service_role receives CRUD/execute grants. `fitness_read(actor, today)` and `fitness_mutate(actor, kind, id, input, remove)` are SECURITY INVOKER with fixed empty search paths and qualified relations. They independently check active role and ownership; missing and foreign IDs have identical failures. Per-owner transaction advisory locks serialize mutations and atomically switch active plans/goals.

`fitness_read` returns owner-only plans, days, goals, latest 20 sessions, and current-week summary. Monday–Sunday totals include all weekly sessions independently of that cap. Progress uses the active target, rounds and caps at 100%; without a target the percentage is null. Minutes sum known durations only and include a separate unknown-duration count. The next planned workout scans today through the following seven days and skips a matching plan day already completed on the candidate date. There is no stored derived progress, calendar event, notification, sharing rule, or exercise/set/rep/weight schema.

Correction Batch C1 adds dated personal fitness plans through `personal_activity_plans`; those plans are separate from recurring `fitness_plans` templates, link to PERSONAL calendar events, and create an actual `fitness_sessions` row only when the owner completes a plan.

---

# 10. Study Domain

## Implemented private Study (Feature 4A)

All four tables have UUID primary keys, `owner_member_id` referencing family_members, and UTC `created_at`/`updated_at` timestamps. Owners must be active ADMIN/MEMBER and cannot be changed.

- `study_semesters`: trimmed `name` (1–120), `start_date`, `end_date >= start_date`, `is_active`. Dates are 2000–2199; a partial unique index permits at most one active semester per owner.
- `study_courses`: `semester_id`, trimmed `name` (1–120), nullable trimmed `code` (1–40). Composite `(owner_member_id, semester_id)` FK references an owned semester. No visual metadata is required for this foundation.
- `study_goals`: nullable `course_id`, trimmed `title` (1–160), nullable `target_minutes` (1–10080), nullable `target_date`, `status` ACTIVE/COMPLETED. The composite course FK guarantees same-owner links.
- `study_sessions`: nullable same-owner `course_id`, family-local DATE `studied_at` (not future), `duration_minutes` (1–1440), nullable trimmed `note` (1–1000). A study log is not a calendar event.

Foreign-key deletion is RESTRICT: deleting a semester/course never cascades learning history. Owners explicitly unlink or delete dependents first. Indexes support owner/date reads and semester relationships.

`study_read(actor, today)` returns only that active actor's own data and a Monday–Sunday summary: all weekly minutes/session count, per-course minutes (including unlinked self-study), and current-week course-filtered/all-course minutes for ACTIVE goals. Its latest-session list is limited to 50, but aggregates are not. `study_mutate` performs owner-scoped CRUD and atomically switches the active semester under a per-owner transaction lock. Foreign/missing record IDs return the same not-found error. Both RPCs are service_role-only SECURITY INVOKER with fixed empty search paths.

All four tables enable RLS without browser policies; PUBLIC/anon/authenticated table/function privileges are revoked. Only server service_role has CRUD/RPC privileges. PARENT has no workspace or member Study access; ADMIN has no ownership bypass. Feature 4B adds the assessment table below; no sharing tables or notifications are added. Correction Batch C1 adds owner-only dated Study plans through `personal_activity_plans`; they remain private PERSONAL calendar entries and create an actual `study_sessions` row only after completion. Home returns own Study summaries and activity progress for ADMIN/MEMBER and omits Study and activity data for PARENT.

---

## study_assessments (Feature 4B)

UUID `id`; immutable `owner_member_id`; required `course_id` with a composite owner/course FK to study_courses (RESTRICT deletion); trimmed `title` (1–160); `assessment_type` QUIZ/ASSIGNMENT/MIDTERM/FINAL/PROJECT/PRESENTATION/OTHER; nullable numeric `score`/`max_score`; nullable `letter_grade` (1–20); nullable numeric `weight_percent`; nullable DATE `assessed_at`; nullable `note` (1–1000); UTC `created_at`/`updated_at`.

Numeric fields have at most four decimal places. Score is 0–1,000,000; a supplied score requires maximum > 0 and score <= maximum. Maximum alone is allowed for pending work; maximum is at most 1,000,000. Weight is independently 0–100, including zero. Dates are 2000–2199; optional dates may be future plans. No redundant percentage column is stored.

Owner/course/date indexing supports private lists. The existing Study owner guard enforces active ADMIN/MEMBER and immutable identity. `study_assessment_read(actor, course?)` scopes courses/rows to the actor and returns the same not-found error for foreign/missing course filters. `study_assessment_mutate` scopes updates/deletes to the actor and shares the existing per-owner Study transaction lock. Both are SECURITY INVOKER, fixed empty search path, service_role-only. RLS is enabled with no browser policies; PUBLIC/anon/authenticated privileges are revoked.

StudyService derives numeric percentages, arithmetic mean percentages, scored-weight coverage, and weighted earned percentage points. Missing/letter-only scores are excluded; partial coverage is labelled, oversubscribed coverage withholds the weighted result, and no GPA/final grade is inferred. Home projects only the actor's latest result (course/title/score/max/letter), never notes/history; PARENT receives no grade data.

---

# 11. Shared Family Food Spending (Feature 5B)

Migration: `20261022140000_create_family_food_expenses.sql`.

`family_food_expenses`: UUID id, meal_date (completed family-local date, 2000–2199), meal_type BREAKFAST/DINNER only, optional trimmed note (1000 characters), created_by_member_id FK with RESTRICT, UTC created_at/updated_at. One itemized entry per date/type; an existing slot must be edited, never duplicated.

`family_food_expense_items`: UUID id, food_expense_id FK with CASCADE, trimmed nonblank name (1–120 characters), bigint amount (1–1,000,000,000 whole VND), unique sort_order within the meal (0–29), UTC timestamps. Deferred constraints forbid committed empty meals. Totals derive from items, never stored. An atomic mutation replaces only expense items; no meal history or ratings are touched.

All active members read shared food costs. Only active PARENT manages them; ADMIN has no override. Both tables have default-deny RLS, no browser policies/grants, and backend-only service_role access. SECURITY INVOKER RPCs independently validate active actor/parent role, dates/items, with fixed empty search paths and qualified relations. Writes serialize with a transaction advisory lock. Monthly totals and previous-month/breakfast/dinner breakdown are independent of 20-entry pagination; currency is canonical integer text in JSON.

Meal date/type gives stable context. Names are editable snapshots suggested from finalized dinner or SELECTED/CUSTOM breakfast responses, without invented prices or brittle dish FKs. Read-only Bếp shows dated item snapshots and derived totals. Personal expenses remain entirely owner-scoped, in separate tables/RPCs. Verification: `database/tests/family-food.rollback.sql` (synthetic rollback-only).

---

# 12. Personal Expense Domain

## personal_expenses

Feature 5A migration: `20261022130000_create_private_personal_expenses.sql`.

UUID `id`; required `owner_member_id` FK to `family_members` with RESTRICT; bigint `amount` (1–1,000,000,000 whole VND); completed family-local `spent_on` date (2000–2199, not future); category FOOD/TRANSPORT/SHOPPING/ENTERTAINMENT/STUDY/FITNESS/BILLS/OTHER; optional trimmed `note` (1–1000 characters); UTC `created_at`/`updated_at`. Currency is fixed VND, not a per-record browser choice. Owner/date/creation/id index supports scoped chronological month reads. Repeated same-date expenses are allowed; each is a separate intentional record.

Default-deny RLS has no browser policies. PUBLIC/anon/authenticated grants are revoked; backend service_role alone receives CRUD and RPC execute. Triggers require active owners of any current family role, immutable row/owner identities, and maintain timestamps. Neither ADMIN nor PARENT bypasses ownership.

SECURITY INVOKER functions `personal_expense_read(actor, month, page)` and `personal_expense_mutate(actor, id, input, remove)` have fixed empty search paths and qualified relations. Session actor identity scopes every query/mutation; client owner fields cannot select a different owner. Foreign/missing IDs have the same error. Per-owner transaction advisory locks serialize writes.

Read RPC returns 20-row month pages, whole-month count/totals, previous-calendar-month total, and non-zero category totals. Money is cast to canonical text in JSON to avoid JavaScript precision loss. The service uses BigInt for signed difference and rounded percentage ratios; no derived money summary is stored. Home explicitly projects only own month/currency/totals/comparison, not expense records or notes. Rollback-only verification: `database/tests/personal-expense.rollback.sql`. Feature 5A creates no shared tables or personal sharing policies; Feature 5B uses the separate family_food_expenses domain above.

---

# 13. Gamification Domain

## achievement_definitions

Suggested fields:

id

code

name

description

icon

category

is_active

created_at

updated_at

---

## member_achievements

Suggested fields:

id

member_id

achievement_id

earned_at

metadata

---

# 14. Audit Fields

Most mutable tables should include:

created_at

updated_at

Where ownership matters, include:

owner_id

or an equivalent relationship.

Avoid duplicating ownership unnecessarily when it can be reliably derived from a parent relationship.

---

# 15. ID Strategy

Use UUID primary keys unless implementation constraints provide a strong reason not to.

Do not expose sequential assumptions in application logic.

---

# 16. Money

Money must not be represented using floating-point application logic.

Use an appropriate database numeric representation.

For VND, the system may store whole currency units.

---

# 17. Dates and Times

The family operates primarily in Vietnam local time.

Application code must not blindly assume server timezone.

Store timestamps consistently and convert them for display.

Date-only concepts such as:

meal date

weight date

expense date

should remain logically separate from exact timestamps.

---

# 18. Migration Rule

All production database schema changes must eventually be represented as migrations.

Avoid undocumented manual production schema edits.

Seed data should be used for:

initial family roles;

development users;

initial breakfast catalog;

other safe development defaults.

Real PINs or private family information must not appear in public seed data.

---

# 19. Implementation Rule

Feature 6B adds no tables or columns. Restricted profile/security RPCs validate the active actor/session, whitelist own display-name/avatar updates, and rotate credentials plus revoke all target sessions atomically. Only ADMIN may recover another active member; the actor's verified current hash is checked again inside the transaction. Hash-bound login/session RPCs reject stale credentials after rotation. Existing default-deny RLS, roles, ownership, and private-record sharing rules remain unchanged. See `20261022160000_add_profile_security_functions.sql` and `database/tests/profile-security.rollback.sql`.

This document describes the expected long-term model.

Do not generate every table immediately.

Tables should be created feature by feature.

Example:

Authentication feature:

family_members

auth_credentials

Meal feature:

required meal tables

This keeps migrations understandable and Git commits meaningful.
