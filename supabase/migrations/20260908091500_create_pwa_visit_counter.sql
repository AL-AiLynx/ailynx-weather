create table if not exists public.pwa_visit_stats (
  stat_date date primary key,
  visits bigint not null default 0 check (visits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pwa_visit_stats enable row level security;
revoke all on table public.pwa_visit_stats from anon, authenticated;

create or replace function public.get_pwa_visit_stats(p_today date)
returns table(total_visits bigint, today_visits bigint)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(sum(visits), 0)::bigint as total_visits,
    coalesce(sum(visits) filter (where stat_date = p_today), 0)::bigint as today_visits
  from public.pwa_visit_stats;
$$;

create or replace function public.record_pwa_visit(p_today date)
returns table(total_visits bigint, today_visits bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pwa_visit_stats (stat_date, visits)
  values (p_today, 1)
  on conflict (stat_date) do update
    set visits = public.pwa_visit_stats.visits + 1,
        updated_at = now();

  return query
  select
    coalesce(sum(visits), 0)::bigint as total_visits,
    coalesce(sum(visits) filter (where stat_date = p_today), 0)::bigint as today_visits
  from public.pwa_visit_stats;
end;
$$;

revoke all on function public.get_pwa_visit_stats(date) from public, anon, authenticated;
revoke all on function public.record_pwa_visit(date) from public, anon, authenticated;
grant execute on function public.get_pwa_visit_stats(date) to service_role;
grant execute on function public.record_pwa_visit(date) to service_role;
