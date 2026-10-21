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

## record_shares

Allows specific records to override module-level privacy.

Suggested fields:

id

owner_id

resource_type

resource_id

shared_with_member_id

permission

created_at

Initial permission:

READ

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

---

## meal_request_options

Used for OPTION_POLL.

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

Names must be trimmed and nonblank (up to 120 characters). Every finalized save has 1–30 dishes with explicit zero-based order. The backend replaces the entire list atomically. A deferred constraint prevents a committed final meal from having no dishes; the dish foreign key prevents orphans and cascades with a deleted meal. Both tables have RLS enabled, no browser policies, and backend `service_role` access only.

---

## dish_ratings

Rating for a specific meal dish.

Suggested fields:

id

meal_dish_id

author_id

rating

comment

created_at

updated_at

Rating range:

1–5

One member should normally submit at most one active rating per meal dish.

---

# 5. Timetable Domain

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

## chore_schedules

Suggested fields:

id

created_by

week_start_date

created_at

updated_at

---

## chore_assignments

Suggested fields:

id

schedule_id

assignment_date

assigned_member_id

chore_type

status

created_at

updated_at

Initial chore type:

DISHWASHING

Possible future status:

PENDING

COMPLETED

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

Suggested fields:

id

owner_id

height_cm

target_weight_kg

activity_level

created_at

updated_at

---

## weight_entries

Suggested fields:

id

owner_id

weight_kg

recorded_date

notes

created_at

updated_at

One user may have multiple historical entries.

---

# 9. Fitness Domain

## fitness_goals

Suggested fields:

id

owner_id

weekly_session_target

start_date

end_date

created_at

updated_at

---

## workout_plans

Suggested fields:

id

owner_id

name

is_active

created_at

updated_at

---

## workout_plan_days

Suggested fields:

id

workout_plan_id

day_of_week

title

notes

created_at

---

## workout_sessions

Suggested fields:

id

owner_id

workout_plan_day_id

session_date

duration_minutes

notes

completed

created_at

updated_at

Future tables may support:

exercises

sets

repetitions

weight used

Do not implement those details in Version 1 unless needed.

---

# 10. Study Domain

## study_courses

Suggested fields:

id

owner_id

semester_id

name

code

created_at

updated_at

---

## study_goals

Suggested fields:

id

owner_id

course_id

target_minutes_per_week

start_date

end_date

created_at

updated_at

---

## study_sessions

Suggested fields:

id

owner_id

course_id

study_date

duration_minutes

notes

created_at

updated_at

---

## assessments

Suggested fields:

id

owner_id

course_id

name

assessment_date

score

max_score

letter_grade

notes

created_at

updated_at

---

# 11. Household Expense Domain

## household_food_expenses

Suggested fields:

id

entered_by

expense_date

amount

currency

category

note

related_meal_id

created_at

updated_at

Initial currency:

VND

Possible categories:

BREAKFAST

GROCERIES

EATING_OUT

DRINKS

OTHER

Mom is the normal creator of these records.

---

# 12. Personal Expense Domain

## personal_expenses

Suggested fields:

id

owner_id

expense_date

amount

currency

category

note

created_at

updated_at

Possible categories:

FOOD

TRANSPORT

SHOPPING

ENTERTAINMENT

EDUCATION

BILLS

OTHER

These records are private by default.

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
