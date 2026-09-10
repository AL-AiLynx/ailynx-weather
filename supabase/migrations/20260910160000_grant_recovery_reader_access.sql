begin;

-- The read Edge Function uses service_role and must read the separate,
-- RLS-protected recovery projection without granting browser roles access.
grant select on table public.as1_recovered_observations to service_role;

commit;
