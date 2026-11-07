-- Rollback-only verification for personal calendar week duplication.
-- Uses synthetic owners and dated events, then rolls back every write.
begin;

insert into public.family_members(id, display_name, role) values
  ('d7111111-1111-4111-8111-111111111111', 'Synthetic Copy Parent', 'PARENT'),
  ('d7222222-2222-4222-8222-222222222222', 'Synthetic Copy Admin', 'ADMIN'),
  ('d7333333-3333-4333-8333-333333333333', 'Synthetic Copy Member', 'MEMBER');

set local role service_role;

do $$
declare
  parent_id constant uuid := 'd7111111-1111-4111-8111-111111111111';
  admin_id constant uuid := 'd7222222-2222-4222-8222-222222222222';
  member_id constant uuid := 'd7333333-3333-4333-8333-333333333333';
  semester_id constant uuid := 'd7444444-4444-4444-8444-444444444444';
  study_course_id constant uuid := 'd7555555-5555-4555-8555-555555555555';
  one_off_id uuid;
  recurring_id uuid;
  activity_id constant uuid := 'd7666666-6666-4666-8666-666666666666';
  result jsonb;
  copied integer;
begin
  insert into public.study_semesters(id, owner_member_id, name, start_date, end_date, is_active)
  values (semester_id, member_id, 'Synthetic semester', '2099-05-01', '2099-06-30', true);
  insert into public.study_courses(id, owner_member_id, semester_id, name, code)
  values (study_course_id, member_id, semester_id, 'Synthetic course', 'COPY');

  one_off_id := public.calendar_save_event(
    member_id, null, 'Synthetic personal event', 'PERSONAL',
    '2099-05-04 02:00:00+00', '2099-05-04 03:00:00+00', 'Copy note', null, null, 'PERSONAL'
  );
  recurring_id := public.calendar_save_event(
    member_id, null, 'Synthetic recurring event', 'PERSONAL',
    '2099-05-04 04:00:00+00', '2099-05-04 05:00:00+00', null, array[1], '2099-06-30', 'PERSONAL'
  );
  perform public.activity_plan_save(
    member_id, 'STUDY', null,
    jsonb_build_object(
      'requestId', activity_id,
      'title', 'Synthetic study plan',
      'startsAt', '2099-05-06 02:00:00+00',
      'endsAt', '2099-05-06 03:00:00+00',
      'courseId', study_course_id,
      'note', 'Plan note'
    )
  );

  begin
    perform public.calendar_duplicate_week(parent_id, '2099-05-04', 'PERSONAL');
    raise exception 'parent personal copy was accepted';
  exception when insufficient_privilege then
    null;
  end;

  copied := public.calendar_duplicate_week(member_id, '2099-05-04', 'PERSONAL');
  result := public.calendar_read(member_id, '2099-05-11', '2099-05-17', member_id, 'PERSONAL');
  if copied <> 2 then
    raise exception 'expected one-off and activity copies, got %', copied;
  end if;

  if public.calendar_duplicate_week(member_id, '2099-05-04', 'PERSONAL') <> 0 then
    raise exception 'retry created duplicate personal events';
  end if;
  if public.calendar_duplicate_week(admin_id, '2099-05-04', 'PERSONAL') <> 0 then
    raise exception 'administrator copied another member calendar';
  end if;

  result := public.calendar_read(member_id, '2099-05-11', '2099-05-17', member_id, 'PERSONAL');
  if (select count(*) from jsonb_array_elements(result->'occurrences') item
      where item->'event'->>'id' = recurring_id::text) <> 1 then
    raise exception 'recurring series was duplicated instead of reused';
  end if;
  if (select count(*) from public.calendar_events
      where owner_member_id = member_id and copied_from_event_id = one_off_id
        and copy_target_week = '2099-05-11') <> 1 then
    raise exception 'one-off copy missing or not idempotent';
  end if;
  if (select count(*) from public.personal_activity_plans
      where owner_member_id = member_id and id <> activity_id
        and kind = 'STUDY' and personal_activity_plans.course_id = study_course_id
        and completed_at is null and not cancelled) <> 1 then
    raise exception 'fresh activity plan copy missing or completed';
  end if;
  if (select count(*) from public.calendar_events
      where owner_member_id = member_id and id <> activity_id
        and starts_at = '2099-05-13 02:00:00+00'::timestamptz) <> 1 then
    raise exception 'activity plan time was not shifted by seven days';
  end if;
  if (select count(*) from public.calendar_events where owner_member_id = admin_id) <> 0 then
    raise exception 'administrator received another member calendar data';
  end if;
end;
$$;

reset role;

do $$
declare
  function_id oid;
begin
  select p.oid into function_id
    from pg_proc p
   where p.oid = 'public.calendar_duplicate_week(uuid,date,text)'::regprocedure;
  if function_id is null
     or (select prosecdef from pg_proc where oid = function_id)
     or not ((select proconfig from pg_proc where oid = function_id) @> array['search_path=""'])
     or has_function_privilege('anon', function_id, 'EXECUTE')
     or has_function_privilege('authenticated', function_id, 'EXECUTE')
     or not has_function_privilege('service_role', function_id, 'EXECUTE') then
    raise exception 'personal duplication RPC security contract failed';
  end if;
end;
$$;

rollback;

select count(*) as synthetic_personal_copy_members_remaining
  from public.family_members
 where id in (
   'd7111111-1111-4111-8111-111111111111',
   'd7222222-2222-4222-8222-222222222222',
   'd7333333-3333-4333-8333-333333333333'
 );
