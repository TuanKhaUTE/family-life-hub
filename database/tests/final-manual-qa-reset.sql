-- FINAL MANUAL QA RESET
--
-- This script is intentionally destructive. Review the target project and the
-- verification output before running it manually. It is not executed by the
-- application, migrations, or automated tests.
--
-- Preserved identity/configuration:
--   * public.family_members (including roles and profile fields)
--   * public.auth_credentials (including PIN hashes and lockout state)
--   * public.breakfast_catalog and its backing public.dishes rows
--   * enum types, functions, RLS policies, and migration history
--
-- Reset data:
--   * transient auth sessions, notifications, breakfast activity, meal plans,
--     calendar/activity records, chores, private learning/fitness/wellness,
--     expenses, ratings, and private record shares.
--
-- No TRUNCATE ... CASCADE is used. Deletes follow the current foreign-key
-- dependency order. The COMMIT near the end is the only transaction finalizer.

begin;

-- Disable the two delete-protective triggers before any DML. PostgreSQL does
-- not allow ALTER TABLE trigger changes after related deferred events are
-- pending in the same transaction. Both triggers are restored before commit.
alter table public.final_meal_dishes disable trigger final_meal_dishes_lock_ready;
alter table public.study_sessions disable trigger activity_session_guard;
alter table public.fitness_sessions disable trigger activity_session_guard;

-- Sessions are transient token state, not login bootstrap configuration. Clear
-- them so QA starts from a fresh login without touching PIN credentials.
delete from public.auth_sessions;

-- Notifications have no domain foreign keys and are always user-created state.
delete from public.notifications;

-- Breakfast responses/purchase state are reset. Catalog/reference rows remain.
delete from public.breakfast_selections;
delete from public.breakfast_purchases;

-- Meal requests and finalized meals: remove children before their parents.
delete from public.final_meal_dish_ratings;

-- Served meals are normally immutable. The ready-composition guard was
-- disabled at transaction start solely for this explicit QA reset.
delete from public.final_meal_dishes;
delete from public.final_meals;

delete from public.meal_responses;
delete from public.meal_request_options;
delete from public.meal_requests;

-- Study practice results depend on study sessions. Linked activity sessions
-- are normally protected from deletion; that guard was disabled at transaction
-- start solely for this explicit QA reset.
delete from public.study_practice_results;
delete from public.study_sessions;
delete from public.fitness_sessions;

-- Personal activity plans depend on calendar events and study courses, while
-- sessions above depend on plans. Remove plans before their referenced parents.
delete from public.personal_activity_plans;

-- Private shares depend on assessments; remove shares before private records.
delete from public.private_record_shares;
delete from public.study_assessments;
delete from public.study_goals;
delete from public.study_courses;
delete from public.study_semesters;

delete from public.fitness_plan_days;
delete from public.fitness_goals;
delete from public.fitness_plans;

delete from public.wellness_weight_logs;
delete from public.wellness_profiles;
delete from public.personal_expenses;

-- Family food items are children of family food expenses.
delete from public.family_food_expense_items;
delete from public.family_food_expenses;

-- Calendar exceptions are children of events.
delete from public.calendar_occurrence_exceptions;
delete from public.calendar_events;

-- Chore occurrences/weekly assignments are children of schedules.
delete from public.chore_occurrences;
delete from public.chore_weekly_assignments;
delete from public.chore_schedules;

-- Household duties are standalone user-created records.
delete from public.household_duties;

-- Flush deferred FK/constraint-trigger events while every dependent row has
-- already been removed. This is required before PostgreSQL permits ALTER TABLE
-- on tables that had pending trigger events in this transaction.
set constraints all immediate;

-- Restore every temporarily disabled trigger before the explicit commit.
alter table public.final_meal_dishes enable trigger final_meal_dishes_lock_ready;
alter table public.study_sessions enable trigger activity_session_guard;
alter table public.fitness_sessions enable trigger activity_session_guard;

-- COMMIT: intentionally review the deletes above before running this script.
commit;

-- Preserved identity and system/reference checks.
select count(*) as preserved_family_member_count
from public.family_members;

select role, count(*) as member_count
from public.family_members
group by role
order by role;

select count(*) as preserved_auth_credential_count
from public.auth_credentials;

select count(*) as preserved_breakfast_catalog_count
from public.breakfast_catalog;

-- Every listed row count should be zero. The dishes table is intentionally
-- omitted: it is the backing reference table for the preserved catalog.
select table_name, row_count
from (
  select 'auth_sessions'::text as table_name, count(*)::bigint as row_count from public.auth_sessions
  union all select 'notifications', count(*) from public.notifications
  union all select 'breakfast_selections', count(*) from public.breakfast_selections
  union all select 'breakfast_purchases', count(*) from public.breakfast_purchases
  union all select 'final_meal_dish_ratings', count(*) from public.final_meal_dish_ratings
  union all select 'final_meal_dishes', count(*) from public.final_meal_dishes
  union all select 'final_meals', count(*) from public.final_meals
  union all select 'meal_responses', count(*) from public.meal_responses
  union all select 'meal_request_options', count(*) from public.meal_request_options
  union all select 'meal_requests', count(*) from public.meal_requests
  union all select 'study_practice_results', count(*) from public.study_practice_results
  union all select 'study_sessions', count(*) from public.study_sessions
  union all select 'fitness_sessions', count(*) from public.fitness_sessions
  union all select 'personal_activity_plans', count(*) from public.personal_activity_plans
  union all select 'private_record_shares', count(*) from public.private_record_shares
  union all select 'study_assessments', count(*) from public.study_assessments
  union all select 'study_goals', count(*) from public.study_goals
  union all select 'study_courses', count(*) from public.study_courses
  union all select 'study_semesters', count(*) from public.study_semesters
  union all select 'fitness_plan_days', count(*) from public.fitness_plan_days
  union all select 'fitness_goals', count(*) from public.fitness_goals
  union all select 'fitness_plans', count(*) from public.fitness_plans
  union all select 'wellness_weight_logs', count(*) from public.wellness_weight_logs
  union all select 'wellness_profiles', count(*) from public.wellness_profiles
  union all select 'personal_expenses', count(*) from public.personal_expenses
  union all select 'family_food_expense_items', count(*) from public.family_food_expense_items
  union all select 'family_food_expenses', count(*) from public.family_food_expenses
  union all select 'calendar_occurrence_exceptions', count(*) from public.calendar_occurrence_exceptions
  union all select 'calendar_events', count(*) from public.calendar_events
  union all select 'chore_occurrences', count(*) from public.chore_occurrences
  union all select 'chore_weekly_assignments', count(*) from public.chore_weekly_assignments
  union all select 'chore_schedules', count(*) from public.chore_schedules
  union all select 'household_duties', count(*) from public.household_duties
) as reset_counts
order by table_name;
