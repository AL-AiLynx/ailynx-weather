-- Preserve raw AS1 receipts exactly as received. Recovery is a separate,
-- lineage-bearing projection for the known pre-fix US100 alert snapshot only.
begin;

create table if not exists public.as1_recovered_observations (
  original_raw_event_id text primary key,
  original_client_event_key text not null,
  asset text not null check (asset = 'US100'),
  ticker_id text not null check (ticker_id = 'SKILLING:US100'),
  venue text not null check (venue = 'SKILLING'),
  symbol text not null check (symbol = 'US100'),
  timeframe text not null check (timeframe in ('4H', '1D')),
  original_source_profile_code text not null,
  recovered_source_profile_code text not null check (recovered_source_profile_code = 'SKILLING_US100_CFD_V1'),
  original_invalid_reason text not null check (original_invalid_reason = 'SOURCE_PROFILE_MISMATCH'),
  recovery_reason text not null check (recovery_reason = 'KNOWN_ALERT_SNAPSHOT_PROFILE_MISMATCH'),
  revalidated boolean not null default true check (revalidated),
  recovery_status text not null default 'RECOVERED' check (recovery_status = 'RECOVERED'),
  recovered_at timestamptz not null default now(),
  original_observed_at timestamptz not null,
  original_received_at timestamptz not null,
  bar_close_time bigint not null check (bar_close_time > 0),
  bar_close numeric not null,
  score numeric not null check (score >= 0 and score <= 100),
  -- The source validator records INVALID when its sole failure is the old
  -- source-profile snapshot. Preserve that actual value; do not invent GOOD.
  sensor_quality text not null check (sensor_quality in ('GOOD', 'LIMITED', 'WATCH', 'INVALID')),
  source_flags text[] not null,
  raw_envelope jsonb not null
);

alter table public.as1_recovered_observations enable row level security;
revoke all on table public.as1_recovered_observations from anon, authenticated;

create index if not exists as1_recovered_observations_lookup_idx
  on public.as1_recovered_observations (asset, ticker_id, timeframe, original_observed_at desc);

-- This insert is deliberately narrow and idempotent. It neither updates nor
-- deletes public.as1_raw_events, and rows with any additional failure flag are
-- excluded rather than being guessed into recoverability.
with candidates as (
  select
    raw.*,
    case upper(raw.timeframe)
      when '240' then '4H'
      when '4H' then '4H'
      when 'D' then '1D'
      when '1D' then '1D'
      when '1440' then '1D'
    end as canonical_timeframe,
    raw.id::text as raw_event_id,
    raw.raw_envelope #>> '{bar,close}' as raw_bar_close,
    raw.raw_envelope #>> '{payload,horus,total}' as raw_score
  from public.as1_raw_events raw
  where raw.satellite_id = 'AS1'
    and raw.platform = 'TRADINGVIEW'
    and raw.layout_id = 'HORUS_A'
    and raw.observer = 'HORUS'
    and raw.packet_type = 'BAR_CLOSE_SNAPSHOT'
    and raw.ticker_id = 'SKILLING:US100'
    and raw.venue = 'SKILLING'
    and raw.symbol = 'US100'
    and raw.source_profile_code = 'CB_BTCUSD_SPOT_20260722_V1'
    and raw.confirmed is true
    and raw.valid is false
    -- `flags` is a non-null jsonb array in the Production AS1 ledger. Exact
    -- equality proves this was the only recorded validation failure.
    and jsonb_typeof(raw.flags) = 'array'
    and raw.flags = jsonb_build_array('SOURCE_PROFILE_MISMATCH')
    and raw.sensor_quality = 'INVALID'
    and raw.raw_envelope #>> '{instrument,ticker_id}' = 'SKILLING:US100'
    and raw.raw_envelope #>> '{instrument,venue}' = 'SKILLING'
    and raw.raw_envelope #>> '{instrument,symbol}' = 'US100'
    and raw.raw_envelope #>> '{source_profile_code}' = 'CB_BTCUSD_SPOT_20260722_V1'
    and raw.raw_envelope #>> '{quality,valid}' = 'false'
    and raw.raw_envelope #>> '{quality,sensor_quality}' = 'INVALID'
    and jsonb_typeof(raw.raw_envelope #> '{bar,close}') = 'number'
    and jsonb_typeof(raw.raw_envelope #> '{payload,horus,total}') = 'number'
)
insert into public.as1_recovered_observations (
  original_raw_event_id, original_client_event_key, asset, ticker_id, venue, symbol, timeframe,
  original_source_profile_code, recovered_source_profile_code, original_invalid_reason,
  recovery_reason, revalidated, recovery_status, original_observed_at, original_received_at,
  bar_close_time, bar_close, score, sensor_quality, source_flags, raw_envelope
)
select
  raw_event_id,
  client_event_key,
  'US100',
  'SKILLING:US100',
  'SKILLING',
  'US100',
  canonical_timeframe,
  source_profile_code,
  'SKILLING_US100_CFD_V1',
  'SOURCE_PROFILE_MISMATCH',
  'KNOWN_ALERT_SNAPSHOT_PROFILE_MISMATCH',
  true,
  'RECOVERED',
  to_timestamp(bar_close_time / 1000.0),
  received_at,
  bar_close_time,
  raw_bar_close::numeric,
  raw_score::numeric,
  sensor_quality,
  array(select jsonb_array_elements_text(flags)),
  raw_envelope
from candidates
where raw_event_id is not null
  and canonical_timeframe is not null
  and bar_close_time > 0
  and raw_bar_close ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'
  and raw_score ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
  and raw_score::numeric between 0 and 100
on conflict (original_raw_event_id) do nothing;

commit;
