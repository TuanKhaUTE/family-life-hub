-- Run after migration. This test uses synthetic fixtures and always rolls back.
begin;
insert into public.family_members(id,display_name,role,is_active) values
 ('e1111111-1111-4111-8111-111111111111','Synthetic Plan Parent','PARENT',true),
 ('e2222222-2222-4222-8222-222222222222','Synthetic Plan Admin','ADMIN',true),
 ('e3333333-3333-4333-8333-333333333333','Synthetic Plan Member','MEMBER',true);
set local role service_role;
do $$
declare
 p constant uuid := 'e1111111-1111-4111-8111-111111111111';
 a constant uuid := 'e2222222-2222-4222-8222-222222222222';
 m constant uuid := 'e3333333-3333-4333-8333-333333333333';
 r uuid; o uuid; n uuid; saved_id uuid; mode_from text; mode_to text; actor uuid;
 stamp constant timestamptz := '2099-06-01 01:00:00Z';
begin
 if not (select relrowsecurity from pg_class where oid='public.meal_requests'::regclass)
   or exists(select 1 from pg_policies where schemaname='public' and tablename in ('meal_requests','meal_responses','meal_request_options'))
   or has_table_privilege('anon','public.meal_requests','INSERT,UPDATE,DELETE,SELECT')
   or has_table_privilege('authenticated','public.meal_requests','INSERT,UPDATE,DELETE,SELECT')
   or has_function_privilege('anon','public.configure_meal_request(uuid,uuid,text,text,timestamptz,text,text[],boolean)','EXECUTE')
   or has_function_privilege('authenticated','public.configure_meal_request(uuid,uuid,text,text,timestamptz,text,text[],boolean)','EXECUTE') then
   raise exception 'RLS or grant regression';
 end if;
 if exists(select 1 from pg_proc where oid='public.configure_meal_request(uuid,uuid,text,text,timestamptz,text,text[],boolean)'::regprocedure
   and (prosecdef or not ('search_path=""'=any(proconfig)))) then raise exception 'RPC security regression'; end if;
 if exists(select 1 from pg_proc, lateral aclexplode(coalesce(proacl,acldefault('f',proowner))) as acl
   where oid='public.configure_meal_request(uuid,uuid,text,text,timestamptz,text,text[],boolean)'::regprocedure and acl.grantee=0) then raise exception 'PUBLIC RPC grant'; end if;

 r := public.create_meal_request(p,'2099-06-01','DINNER','OPEN_CHOICE','2099-06-01 12:00:00Z',null,null);
 begin
   update public.meal_requests set mode=null where id=r;
   raise exception 'interactive request accepted a null mode';
 exception when check_violation then null; end;
 begin
   update public.meal_requests set status='CANCELLED',mode=null where id=r;
   raise exception 'cancelled request accepted a mismatched null mode/deadline';
 exception when check_violation then null; end;
 perform public.save_meal_response(m,r,'CUSTOM',null,'Synthetic soup');
 perform public.save_meal_response(a,r,'NOT_EATING',null,null);
 select id into n from public.notifications where related_resource_id=r and recipient_member_id=m and type='MEAL_REQUEST_STATUS';
 update public.notifications set read_at=stamp where id=n;
 insert into public.notifications(recipient_member_id,type,title,message,related_resource_type,related_resource_id,read_at)
 values(m,'SYNTHETIC_OTHER','Unrelated','Keep this text','SYNTHETIC_OTHER',r,stamp);
 foreach actor in array array[a,m] loop
   begin
     perform public.configure_meal_request(actor,r,'OPEN','OPTION_POLL','2099-06-01 12:00:00Z',null,array['Cơm','Bún'],true);
     raise exception 'non-parent edit accepted';
   exception when insufficient_privilege then null; end;
   begin
     perform public.configure_meal_request(actor,r,'CANCELLED',null,null,null,null,false);
     raise exception 'non-parent cancel accepted';
   exception when insufficient_privilege then null; end;
 end loop;
 begin
   perform public.configure_meal_request(p,r,'OPEN','OPTION_POLL','2099-06-01 12:00:00Z',null,array['Cơm','Bún'],false);
   raise exception 'incompatible response discarded without confirmation';
 exception when sqlstate 'P2002' then null; end;
 if not exists(select 1 from public.meal_responses where meal_request_id=r and member_id=m and response_type='CUSTOM') then raise exception 'unconfirmed edit mutated response'; end if;
 perform public.configure_meal_request(p,r,'OPEN','OPTION_POLL','2099-06-01 12:00:00Z',null,array['Cơm','Bún'],true);
 if exists(select 1 from public.meal_responses where meal_request_id=r and member_id=m)
   or not exists(select 1 from public.meal_responses where meal_request_id=r and member_id=a and response_type='NOT_EATING') then raise exception 'compatible response preservation failed'; end if;
 select id into o from public.meal_request_options where meal_request_id=r and label='Cơm';
 saved_id := public.save_meal_response(m,r,'SELECTED_OPTION',o,null);
 perform public.configure_meal_request(p,r,'OPEN','OPTION_POLL','2099-06-01 12:00:00Z','New note',array['Bún','Cơm','Rau'],false);
 if not exists(select 1 from public.meal_responses where id=saved_id and option_id=o)
   or not exists(select 1 from public.meal_request_options where id=o and sort_order=2) then raise exception 'poll reorder invalidated retained selection'; end if;
 begin
   perform public.configure_meal_request(p,r,'OPEN','OPTION_POLL','2099-06-01 12:00:00Z',null,array['Bún','Rau'],false);
   raise exception 'removed option did not require confirmation';
 exception when sqlstate 'P2002' then null; end;
 perform public.configure_meal_request(p,r,'OPEN','OPTION_POLL','2099-06-01 12:00:00Z',null,array['Bún','Rau'],true);
 if exists(select 1 from public.meal_responses where id=saved_id)
   or not exists(select 1 from public.meal_responses where meal_request_id=r and member_id=a) then raise exception 'removed too many or too few responses'; end if;
 perform public.configure_meal_request(p,r,'CANCELLED',null,null,null,null,false);
 perform public.configure_meal_request(p,r,'CANCELLED',null,null,null,null,false);
 if not exists(select 1 from public.meal_requests where id=r and status='CANCELLED')
   or not exists(select 1 from public.meal_responses where meal_request_id=r and member_id=a) then raise exception 'cancellation deleted history'; end if;
 begin
   perform public.save_meal_response(m,r,'NOT_EATING',null,null);
   raise exception 'cancelled request accepted response';
 exception when check_violation then null; end;
 if not exists(select 1 from public.notifications where id=n and read_at=stamp and title='Bữa tối: đã hủy kế hoạch') then raise exception 'cancel notification/read state mismatch'; end if;
 if public.create_meal_request(p,'2099-06-01','DINNER','OPTION_POLL','2099-06-01 12:00:00Z',null,array['Bún','Rau'])<>r then raise exception 'cancelled create did not reuse row'; end if;
 -- Exercise all six direct mode transitions on the same row.
 foreach mode_from in array array['OPEN_CHOICE','OPTION_POLL','SELF_SERVICE'] loop
   foreach mode_to in array array['OPEN_CHOICE','OPTION_POLL','SELF_SERVICE'] loop
     perform public.configure_meal_request(p,r,case mode_from when 'SELF_SERVICE' then 'SELF_SERVICE' else 'OPEN' end,mode_from,
       case when mode_from='SELF_SERVICE' then null else timestamptz '2099-06-01 12:00:00Z' end,null,
       case when mode_from='OPTION_POLL' then array['Cơm','Bún'] else '{}'::text[] end,true);
     if public.configure_meal_request(p,r,case mode_to when 'SELF_SERVICE' then 'SELF_SERVICE' else 'OPEN' end,mode_to,
       case when mode_to='SELF_SERVICE' then null else timestamptz '2099-06-01 12:00:00Z' end,null,
       case when mode_to='OPTION_POLL' then array['Cơm','Bún'] else '{}'::text[] end,true)<>r then raise exception 'request identity changed'; end if;
   end loop;
 end loop;
 if (select count(*) from public.meal_requests where meal_date='2099-06-01' and meal_type='DINNER')<>1
   or (select count(*) from public.notifications where related_resource_id=r and related_resource_type='MEAL_REQUEST' and recipient_member_id=m)<>1
   or not exists(select 1 from public.notifications where id=n and read_at=stamp)
   or not exists(select 1 from public.notifications where type='SYNTHETIC_OTHER' and related_resource_id=r and read_at=stamp and message='Keep this text') then raise exception 'slot or notification identity regression'; end if;
 -- Expiry remains CLOSED on reads; the stored request is not cancelled.
 perform public.configure_meal_request(p,r,'OPEN','OPEN_CHOICE','2099-06-01 12:00:00Z',null,'{}',true);
 update public.meal_requests set deadline_at=now()-interval '1 minute' where id=r;
 if not exists(select 1 from public.meal_requests where id=r and status='OPEN') then raise exception 'expiry became cancellation'; end if;
 begin
   perform public.save_meal_response(m,r,'CUSTOM',null,'Too late');
   raise exception 'expired request accepted response';
 exception when check_violation then null; end;
end;
$$;
set constraints all immediate;
rollback;
select
 (select count(*) from public.family_members where id in ('e1111111-1111-4111-8111-111111111111','e2222222-2222-4222-8222-222222222222','e3333333-3333-4333-8333-333333333333')) as synthetic_members,
 (select count(*) from public.meal_requests where meal_date='2099-06-01') as synthetic_requests,
 (select count(*) from public.notifications where related_date='2099-06-01' or type='SYNTHETIC_OTHER') as synthetic_notifications;
