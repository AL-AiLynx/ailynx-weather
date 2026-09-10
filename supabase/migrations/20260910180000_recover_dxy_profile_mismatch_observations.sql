-- Preserve raw AS1 receipts exactly as received. Extend the existing recovery
-- projection only for the audited DXY profile-snapshot mismatch.
begin;

alter table public.as1_recovered_observations
  drop constraint as1_recovered_observations_identity_check;

alter table public.as1_recovered_observations
  add constraint as1_recovered_observations_identity_check check (
    (asset = 'US100'
      and ticker_id = 'SKILLING:US100'
      and venue = 'SKILLING'
      and symbol = 'US100'
      and recovered_source_profile_code = 'SKILLING_US100_CFD_V1')
    or
    (asset = 'XAUUSD'
      and ticker_id = 'OANDA:XAUUSD'
      and venue = 'OANDA'
      and symbol = 'XAUUSD'
      and recovered_source_profile_code = 'OANDA_XAUUSD_CFD_V1')
    or
    (asset = 'DXY'
      and ticker_id = 'CAPITALCOM:DXY'
      and venue = 'CAPITALCOM'
      and symbol = 'DXY'
      and recovered_source_profile_code = 'CAPITALCOM_DXY_CFD_V1')
  );

-- This insert is deliberately narrow and idempotent. It reads only the two
-- audited raw DXY receipts, never qualitative history packets.
with candidates as (
  select
    raw.*,
    case upper(raw.timeframe)
      when '240' then '4H'
      when '4H' then '4H'
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
    and raw.ticker_id = 'CAPITALCOM:DXY'
    and raw.venue = 'CAPITALCOM'
    and raw.symbol = 'DXY'
    and raw.source_profile_code = 'CB_BTCUSD_SPOT_20260722_V1'
    and raw.confirmed is true
    and raw.valid is false
    and raw.client_event_key is not null
    and jsonb_typeof(raw.flags) = 'array'
    and raw.flags = jsonb_build_array('SOURCE_PROFILE_MISMATCH')
    and raw.sensor_quality = 'INVALID'
    and raw.raw_envelope #>> '{instrument,ticker_id}' = 'CAPITALCOM:DXY'
    and raw.raw_envelope #>> '{instrument,venue}' = 'CAPITALCOM'
    and raw.raw_envelope #>> '{instrument,symbol}' = 'DXY'
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
  'DXY',
  'CAPITALCOM:DXY',
  'CAPITALCOM',
  'DXY',
  canonical_timeframe,
  source_profile_code,
  'CAPITALCOM_DXY_CFD_V1',
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
  and canonical_timeframe = '4H'
  and bar_close_time > 0
  and raw_bar_close ~ '^-?(0|[1-9][0-9]*)([.][0-9]+)?$'
  and raw_score ~ '^(0|[1-9][0-9]*)([.][0-9]+)?$'
  and raw_score::numeric between 0 and 100
on conflict (original_raw_event_id) do nothing;

commit;
