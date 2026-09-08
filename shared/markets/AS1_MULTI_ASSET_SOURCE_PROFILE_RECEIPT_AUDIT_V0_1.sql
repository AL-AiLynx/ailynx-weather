-- AS1_MULTI_ASSET_SOURCE_PROFILE_V0_1
-- Read-only post-bar-close verification. Do not promote Registry state from
-- this query alone; only a confirmed, valid, non-duplicate current receipt is
-- eligible for manual review. This file contains no write or schema command.
with target(asset, ticker_id, venue, timeframe, source_profile_code) as (
  values
    ('XAUUSD', 'OANDA:XAUUSD', 'OANDA', '4H', 'OANDA_XAUUSD_CFD_V1'),
    ('XAUUSD', 'OANDA:XAUUSD', 'OANDA', '1D', 'OANDA_XAUUSD_CFD_V1'),
    ('DXY', 'CAPITALCOM:DXY', 'CAPITALCOM', '4H', 'CAPITALCOM_DXY_CFD_V1'),
    ('DXY', 'CAPITALCOM:DXY', 'CAPITALCOM', '1D', 'CAPITALCOM_DXY_CFD_V1'),
    ('US100', 'SKILLING:US100', 'SKILLING', '4H', 'SKILLING_US100_CFD_V1'),
    ('US100', 'SKILLING:US100', 'SKILLING', '1D', 'SKILLING_US100_CFD_V1')
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
  where ticker_id in ('OANDA:XAUUSD', 'CAPITALCOM:DXY', 'SKILLING:US100')
), ranked as (
  select
    target.asset,
    target.ticker_id as ticker,
    target.venue as source,
    target.timeframe,
    target.source_profile_code as expected_source_profile_code,
    raw.source_profile_code as received_source_profile_code,
    raw.received_at,
    raw.client_event_key,
    raw.confirmed,
    raw.valid,
    raw.sensor_quality as quality,
    raw.flags,
    coalesce(raw.event_key_count, 0) > 1 as duplicate,
    row_number() over (
      partition by target.asset, target.timeframe
      order by raw.received_at desc nulls last
    ) as receipt_rank
  from target
  left join normalized_raw raw
    on raw.ticker_id = target.ticker_id
   and raw.venue = target.venue
   and raw.timeframe = target.timeframe
)
select
  asset,
  ticker,
  source,
  timeframe,
  expected_source_profile_code,
  received_source_profile_code,
  case when received_at is null then 'NOT_RECEIVED' else 'RECEIVED' end as receipt_status,
  received_at,
  client_event_key,
  valid,
  quality,
  duplicate,
  case
    when received_at is null then false
    when confirmed is true
      and valid is true
      and duplicate is false
      and received_source_profile_code = expected_source_profile_code
    then true
    else false
  end as eligible_for_manual_live_review,
  flags
from ranked
where receipt_rank = 1
order by asset, case timeframe when '4H' then 1 else 2 end;
