-- Typed reference preserves source ownership and deletion safety without enabling future types.
alter table public.study_assessments add constraint study_assessments_owner_identity unique(owner_member_id,id);
create table public.private_record_shares (
 id uuid primary key default gen_random_uuid(),
 owner_member_id uuid not null references public.family_members(id) on delete restrict,
 recipient_member_id uuid not null references public.family_members(id) on delete cascade,
 resource_type text not null check(resource_type='STUDY_ASSESSMENT'),
 resource_id uuid not null,
 assessment_id uuid generated always as (case when resource_type='STUDY_ASSESSMENT' then resource_id end) stored,
 created_at timestamptz not null default now(),
 check(owner_member_id<>recipient_member_id),
 unique(owner_member_id,recipient_member_id,resource_type,resource_id),
 foreign key(owner_member_id,assessment_id) references public.study_assessments(owner_member_id,id) on delete cascade
);
create index private_shares_received on public.private_record_shares(recipient_member_id,created_at desc,id desc);
create index private_shares_source on public.private_record_shares(owner_member_id,resource_type,resource_id);
alter table public.private_record_shares enable row level security;
revoke all privileges on public.private_record_shares from public,anon,authenticated;
grant select,insert,delete on public.private_record_shares to service_role;

create function public.private_share_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=new.owner_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'active source owner required' using errcode='42501';end if;
 perform 1 from public.family_members where id=new.recipient_member_id and is_active and role in('ADMIN','MEMBER','PARENT') for share;
 if not found then raise exception 'active recipient required' using errcode='22023';end if;
 return new;
end $$;
create trigger private_share_guard before insert or update on public.private_record_shares for each row execute function public.private_share_guard();

create function public.private_share_create(p_actor_member_id uuid,p_resource_type text,p_resource_id uuid,p_recipient_member_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare share_id uuid;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'share ownership required' using errcode='42501';end if;
 if p_resource_type is distinct from 'STUDY_ASSESSMENT' or p_resource_id is null or p_recipient_member_id is null or p_actor_member_id=p_recipient_member_id then raise exception 'invalid sharing input' using errcode='22023';end if;
 -- Same lock order as Study mutation; source deletion cannot race share creation.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study:'||p_actor_member_id::text,0));
 perform 1 from public.study_assessments where id=p_resource_id and owner_member_id=p_actor_member_id for key share;
 if not found then raise exception 'record not found' using errcode='P0002';end if;
 insert into public.private_record_shares(owner_member_id,recipient_member_id,resource_type,resource_id)
 values(p_actor_member_id,p_recipient_member_id,p_resource_type,p_resource_id)
 on conflict(owner_member_id,recipient_member_id,resource_type,resource_id) do nothing;
 select id into share_id from public.private_record_shares where owner_member_id=p_actor_member_id and recipient_member_id=p_recipient_member_id and resource_type=p_resource_type and resource_id=p_resource_id;
 return share_id;
end $$;

create function public.private_share_revoke(p_actor_member_id uuid,p_share_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'share ownership required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study:'||p_actor_member_id::text,0));
 delete from public.private_record_shares where id=p_share_id and owner_member_id=p_actor_member_id;
 if not found then raise exception 'record not found' using errcode='P0002';end if;
end $$;

create function public.private_share_owner(p_actor_member_id uuid,p_resource_type text,p_resource_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'share ownership required' using errcode='42501';end if;
 if p_resource_type is distinct from 'STUDY_ASSESSMENT' or p_resource_id is null then raise exception 'unsupported sharing resource' using errcode='22023';end if;
 if not exists(select 1 from public.study_assessments where id=p_resource_id and owner_member_id=p_actor_member_id) then raise exception 'record not found' using errcode='P0002';end if;
 return jsonb_build_object(
  'recipients',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'displayName',display_name,'avatarType',avatar_type,'avatarValue',avatar_value) order by display_name,id),'[]'::jsonb) from (
   select id,display_name,avatar_type,avatar_value from public.family_members where id<>p_actor_member_id and is_active and role in('ADMIN','MEMBER','PARENT') order by display_name,id limit 100
  ) eligible),
  'shares',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sharedAt',s.created_at,'recipient',jsonb_build_object('id',r.id,'displayName',r.display_name,'avatarType',r.avatar_type,'avatarValue',r.avatar_value)) order by s.created_at,s.id),'[]'::jsonb)
   from public.private_record_shares s join public.family_members r on r.id=s.recipient_member_id where s.owner_member_id=p_actor_member_id and s.resource_type=p_resource_type and s.resource_id=p_resource_id)
 );
end $$;

create function public.private_share_received(p_actor_member_id uuid,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER','PARENT')) then raise exception 'active recipient required' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid sharing page' using errcode='22023';end if;
 return (with available as (
  select s.id,s.created_at,o.display_name,o.avatar_type,o.avatar_value,c.name as course_name,a.title,a.assessment_type,a.score,a.max_score,a.letter_grade,a.assessed_at
  from public.private_record_shares s
  join public.family_members o on o.id=s.owner_member_id and o.is_active and o.role in('ADMIN','MEMBER')
  join public.study_assessments a on a.id=s.resource_id and a.owner_member_id=s.owner_member_id
  join public.study_courses c on c.id=a.course_id and c.owner_member_id=a.owner_member_id
  where s.recipient_member_id=p_actor_member_id and s.resource_type='STUDY_ASSESSMENT'
 ) select jsonb_build_object('totalCount',(select count(*) from available),
  'records',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'resourceType','STUDY_ASSESSMENT','sharedAt',v.created_at,
   'owner',jsonb_build_object('displayName',v.display_name,'avatarType',v.avatar_type,'avatarValue',v.avatar_value),
   'assessment',jsonb_build_object('courseName',v.course_name,'title',v.title,'assessmentType',v.assessment_type,'score',v.score,'maxScore',v.max_score,'letterGrade',v.letter_grade,'assessedAt',v.assessed_at))
   order by v.created_at desc,v.id desc),'[]'::jsonb) from (select * from available order by created_at desc,id desc limit 20 offset((p_page-1)*20)) v)));
end $$;
revoke all privileges on function public.private_share_guard(),public.private_share_create(uuid,text,uuid,uuid),public.private_share_revoke(uuid,uuid),public.private_share_owner(uuid,text,uuid),public.private_share_received(uuid,integer) from public,anon,authenticated;
grant execute on function public.private_share_guard(),public.private_share_create(uuid,text,uuid,uuid),public.private_share_revoke(uuid,uuid),public.private_share_owner(uuid,text,uuid),public.private_share_received(uuid,integer) to service_role;
