-- AS1_DOMINANCE_RECEIPT_AUDIT_V0_1
-- Read-only post-alert audit. No LIVE promotion and no row mutation.

with target(instrument_key, ticker_id, venue, timeframe, source_profile_code) as (
  values
    ('BTC_D', 'CRYPTOCAP:BTC.D', 'CRYPTOCAP', '4H', 'CRYPTOCAP_BTC_D_DOMINANCE_V1'),
    ('BTC_D', 'CRYPTOCAP:BTC.D', 'CRYPTOCAP', '1D', 'CRYPTOCAP_BTC_D_DOMINANCE_V1'),
    ('USDT_D', 'CRYPTOCAP:USDT.D', 'CRYPTOCAP', '4H', 'CRYPTOCAP_USDT_D_DOMINANCE_V1'),
    ('USDT_D', 'CRYPTOCAP:USDT.D', 'CRYPTOCAP', '1D', 'CRYPTOCAP_USDT_D_DOMINANCE_V1'),
    ('USDC_D', 'CRYPTOCAP:USDC.D', 'CRYPTOCAP', '4H', 'CRYPTOCAP_USDC_D_DOMINANCE_V1'),
    ('USDC_D', 'CRYPTOCAP:USDC.D', 'CRYPTOCAP', '1D', 'CRYPTOCAP_USDC_D_DOMINANCE_V1')
), normalized_raw as (
  select
    ticker_id,
    venue,
    source_profile_code,
    case upper(timeframe)
      when '240' then '4H'
      when 'D' then '1D'
      when '1440' then '1D'
      else upper(timeframe)
    end as timeframe,
    received_at,
    client_event_key,
    confirmed,
    valid,
    sensor_quality,
    flags,
    count(*) over (partition by client_event_key) as event_key_count
  from public.as1_raw_events
  where ticker_id in ('CRYPTOCAP:BTC.D', 'CRYPTOCAP:USDT.D', 'CRYPTOCAP:USDC.D')
), ranked as (
  select
    target.instrument_key,
    target.ticker_id,
    target.venue,
    target.timeframe,
    target.source_profile_code as expected_source_profile_code,
    raw.source_profile_code as received_source_profile_code,
    raw.received_at,
    raw.client_event_key,
    raw.confirmed,
    raw.valid,
    raw.sensor_quality,
    raw.flags,
    coalesce(raw.event_key_count, 0) > 1 as duplicate,
    row_number() over (
      partition by target.instrument_key, target.timeframe
      order by raw.received_at desc nulls last
    ) as receipt_rank
  from target
  left join normalized_raw raw
    on raw.ticker_id = target.ticker_id
   and raw.venue = target.venue
   and raw.timeframe = target.timeframe
)
select
  instrument_key,
  ticker_id,
  venue,
  timeframe,
  expected_source_profile_code,
  received_source_profile_code,
  received_at,
  client_event_key,
  confirmed,
  valid,
  case when received_at is null then null
       when valid is true then null
       else coalesce(array_to_string(flags, ','), 'INVALID_WITHOUT_REASON')
  end as invalid_reason,
  sensor_quality,
  duplicate,
  received_at is not null
    and confirmed is true
    and valid is true
    and received_source_profile_code = expected_source_profile_code
    and duplicate is false as eligible_for_manual_review,
  flags
from ranked
where receipt_rank = 1
order by instrument_key, case timeframe when '4H' then 1 else 2 end;
