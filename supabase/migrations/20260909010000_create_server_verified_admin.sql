begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'ADMIN',
  created_at timestamptz not null default now(),
  constraint admin_users_role_check check (role = 'ADMIN')
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
grant all on table public.admin_users to service_role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select admin.role = 'ADMIN'
    from public.admin_users as admin
    where admin.user_id = auth.uid()
  ), false);
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to anon, authenticated;

insert into public.admin_users (user_id, role)
select '37c17a3a-41c5-494f-a46a-bb8ef59085c1'::uuid, 'ADMIN'
where exists (
  select 1
  from auth.users
  where id = '37c17a3a-41c5-494f-a46a-bb8ef59085c1'::uuid
)
on conflict (user_id) do update set role = excluded.role;

comment on table public.admin_users is 'Server-verified AiLynx administrator identities.';
comment on function public.is_current_user_admin() is 'Returns whether auth.uid() is an ADMIN; accepts no user or email parameter.';

commit;
