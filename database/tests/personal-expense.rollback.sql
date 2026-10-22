begin;
insert into public.family_members(id,display_name,role) values
 ('e5111111-1111-4111-8111-111111111111','Synthetic Expense Admin','ADMIN'),
 ('e5222222-2222-4222-8222-222222222222','Synthetic Expense Member','MEMBER'),
 ('e5333333-3333-4333-8333-333333333333','Synthetic Expense Parent','PARENT'),
 ('e5444444-4444-4444-8444-444444444444','Synthetic Expense Inactive','MEMBER');
update public.family_members set is_active=false where id='e5444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 a uuid:='e5111111-1111-4111-8111-111111111111'; b uuid:='e5222222-2222-4222-8222-222222222222';
 p uuid:='e5333333-3333-4333-8333-333333333333'; inactive uuid:='e5444444-4444-4444-8444-444444444444';
 actor uuid; other_actor uuid; eid uuid; foreign_id uuid; data jsonb;
 input jsonb:='{"amount":"120000","spentOn":"2026-10-22","category":"TRANSPORT","note":"Synthetic expense note"}';
begin
 foreach actor in array array[a,b,p] loop
  data:=public.personal_expense_read(actor,'2026-10-01',1);
  if data->>'currentTotal'<>'0' or data->>'previousTotal'<>'0' or data->'categories'<>'[]'::jsonb then raise exception 'invented empty expenses'; end if;
  perform public.personal_expense_mutate(actor,null,input,false);
  perform public.personal_expense_mutate(actor,null,input||'{"amount":"30000","category":"FOOD"}',false);
  perform public.personal_expense_mutate(actor,null,input||'{"amount":"100000","spentOn":"2026-09-30"}',false);
  data:=public.personal_expense_read(actor,'2026-10-01',1);
  if data->>'currentTotal'<>'150000' or data->>'previousTotal'<>'100000' or data->>'totalCount'<>'2' then raise exception 'monthly totals wrong'; end if;
  if data->'categories'->0->>'category'<>'TRANSPORT' or data->'categories'->0->>'amount'<>'120000' then raise exception 'category totals wrong'; end if;
  eid:=(select id from public.personal_expenses where owner_member_id=actor and amount=120000);
  perform public.personal_expense_mutate(actor,eid,input||'{"amount":"125000"}',false);
  if public.personal_expense_read(actor,'2026-10-01',1)->>'currentTotal'<>'155000' then raise exception 'update total wrong'; end if;
  begin perform public.personal_expense_mutate(actor,null,input||'{"amount":"0"}',false); raise exception 'zero amount accepted'; exception when check_violation then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||'{"amount":"-1"}',false); raise exception 'negative amount accepted'; exception when check_violation then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||'{"amount":"1000000001"}',false); raise exception 'unbounded amount accepted'; exception when check_violation then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||'{"amount":"1.5"}',false); raise exception 'fractional VND accepted'; exception when invalid_text_representation then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||'{"category":"HOUSEHOLD_FOOD"}',false); raise exception 'foreign category accepted'; exception when check_violation then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||'{"spentOn":"2026-02-30"}',false); raise exception 'invalid date accepted'; exception when datetime_field_overflow then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||jsonb_build_object('spentOn',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1),false); raise exception 'future expense accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.personal_expense_mutate(actor,null,input||jsonb_build_object('note',repeat('x',1001)),false); raise exception 'long note accepted'; exception when check_violation then null; end;
  begin update public.personal_expenses set owner_member_id=case when actor=a then b else a end where id=eid; raise exception 'owner changed'; exception when insufficient_privilege then null; end;
 end loop;
 -- Every role pair is isolated: neither ADMIN nor PARENT has a bypass.
 foreach actor in array array[a,b,p] loop
  foreach other_actor in array array[a,b,p] loop
   if actor=other_actor then continue; end if;
   foreign_id:=(public.personal_expense_read(other_actor,'2026-10-01',1)->'expenses'->0->>'id')::uuid;
   if exists(select 1 from jsonb_array_elements(public.personal_expense_read(actor,'2026-10-01',1)->'expenses') x where x->>'id'=foreign_id::text) then raise exception 'cross-member read'; end if;
   begin perform public.personal_expense_mutate(actor,foreign_id,input,false); raise exception 'cross-member update'; exception when no_data_found then null; end;
   begin perform public.personal_expense_mutate(actor,foreign_id,null,true); raise exception 'cross-member delete'; exception when no_data_found then null; end;
  end loop;
 end loop;
 begin perform public.personal_expense_read(inactive,'2026-10-01',1); raise exception 'inactive read'; exception when insufficient_privilege then null; end;
 begin perform public.personal_expense_mutate(inactive,null,input,false); raise exception 'inactive write'; exception when insufficient_privilege then null; end;
 -- Pagination does not truncate aggregation; zero previous month stays zero.
 for i in 1..22 loop perform public.personal_expense_mutate(a,null,input||'{"amount":"1","spentOn":"2026-01-15"}',false); end loop;
 data:=public.personal_expense_read(a,'2026-01-01',1);
 if data->>'currentTotal'<>'22' or data->>'previousTotal'<>'0' or jsonb_array_length(data->'expenses')<>20 then raise exception 'pagination truncated totals'; end if;
 if jsonb_array_length(public.personal_expense_read(a,'2026-01-01',2)->'expenses')<>2 then raise exception 'second page missing'; end if;
 -- Sum exceeds 32-bit integer range without losing one dong.
 for i in 1..10 loop perform public.personal_expense_mutate(b,null,input||'{"amount":"1000000000","spentOn":"2026-08-15"}',false); end loop;
 if public.personal_expense_read(b,'2026-08-01',1)->>'currentTotal'<>'10000000000' then raise exception 'integer aggregation wrong'; end if;
 foreach actor in array array[a,b,p] loop
  for eid in select id from public.personal_expenses where owner_member_id=actor loop perform public.personal_expense_mutate(actor,eid,null,true); end loop;
  if public.personal_expense_read(actor,'2026-10-01',1)->>'currentTotal'<>'0' then raise exception 'delete left expenses'; end if;
 end loop;
end $$;
reset role;
do $$ declare f record; begin
 if not(select relrowsecurity from pg_class where oid='public.personal_expenses'::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename='personal_expenses') then raise exception 'unsafe expense RLS'; end if;
 if has_table_privilege('anon','public.personal_expenses','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.personal_expenses','SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser grants'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.personal_expenses'::regclass and contype='f' and confrelid='public.family_members'::regclass and confdeltype='r') then raise exception 'missing restrictive owner FK'; end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'personal_expense_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe expense RPC'; end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_expense_members_remaining from public.family_members where id in('e5111111-1111-4111-8111-111111111111','e5222222-2222-4222-8222-222222222222','e5333333-3333-4333-8333-333333333333','e5444444-4444-4444-8444-444444444444');
