-- PostgreSQL CHECK accepts NULL, so make nullable mode combinations fail
-- explicitly instead of bypassing the state contract through three-valued logic.
alter table public.meal_requests drop constraint meal_requests_state_valid;
alter table public.meal_requests add constraint meal_requests_state_valid check (
  coalesce(
    (status in ('OPEN','CLOSED') and mode in ('OPEN_CHOICE','OPTION_POLL') and deadline_at is not null)
    or (status = 'SELF_SERVICE' and mode is null and deadline_at is null)
    or (status = 'CANCELLED' and (
      (mode in ('OPEN_CHOICE','OPTION_POLL') and deadline_at is not null)
      or (mode is null and deadline_at is null)
    )),
    false
  )
);
