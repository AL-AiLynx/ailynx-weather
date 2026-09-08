-- AS1_DOMINANCE_CANONICAL_IDENTITY_V0_1
-- Prepared only. Do not apply before the approved Production change gate.
-- This migration verifies existing 4H/1D PLANNED contracts and updates only
-- canonical identity fields for the three auxiliary dominance instruments.

begin;

do $$
declare
  target_count integer;
  observation_count integer;
begin
  select count(*) into target_count
  from public.instrument_registry
  where (instrument_key, display_symbol, asset_class, category, plan_code, preferred_source, preferred_satellite)
    in (
      ('BTC_D', 'BTC.D', 'DOMINANCE', 'WEATHER', 'WEATHER', 'TRADINGVIEW', 'AS1'),
      ('USDT_D', 'USDT.D', 'DOMINANCE', 'WEATHER', 'WEATHER', 'TRADINGVIEW', 'AS1'),
      ('USDC_D', 'USDC.D', 'DOMINANCE', 'WEATHER', 'WEATHER', 'TRADINGVIEW', 'AS1')
    )
    and observation_status = 'PLANNED'
    and price_availability = 'PLANNED';

  if target_count <> 3 then
    raise exception 'AS1_DOMINANCE_CANONICAL_IDENTITY_V0_1 registry preflight failed';
  end if;

  if exists (
    select 1
    from public.instrument_registry
    where instrument_key in ('BTC_D', 'USDT_D', 'USDC_D')
      and not (
        (ticker_verification_status = 'UNVERIFIED' and canonical_venue is null and canonical_ticker is null)
        or
        (ticker_verification_status = 'VERIFIED' and (instrument_key, canonical_venue, canonical_ticker) in (
          ('BTC_D', 'CRYPTOCAP', 'CRYPTOCAP:BTC.D'),
          ('USDT_D', 'CRYPTOCAP', 'CRYPTOCAP:USDT.D'),
          ('USDC_D', 'CRYPTOCAP', 'CRYPTOCAP:USDC.D')
        ))
      )
  ) then
    raise exception 'AS1_DOMINANCE_CANONICAL_IDENTITY_V0_1 unexpected existing canonical identity';
  end if;

  select count(*) into observation_count
  from public.instrument_observation_registry
  where instrument_key in ('BTC_D', 'USDT_D', 'USDC_D')
    and timeframe in ('4H', '1D')
    and source_code = 'TRADINGVIEW'
    and satellite_code = 'AS1'
    and observation_status = 'PLANNED'
    and live_since is null
    and last_seen_at is null;

  if observation_count <> 6 then
    raise exception 'AS1_DOMINANCE_CANONICAL_IDENTITY_V0_1 expected six unchanged PLANNED observation contracts';
  end if;
end;
$$;

update public.instrument_registry as registry
set canonical_venue = source.canonical_venue,
    canonical_ticker = source.canonical_ticker,
    ticker_verification_status = 'VERIFIED'
from (
  values
    ('BTC_D', 'CRYPTOCAP', 'CRYPTOCAP:BTC.D'),
    ('USDT_D', 'CRYPTOCAP', 'CRYPTOCAP:USDT.D'),
    ('USDC_D', 'CRYPTOCAP', 'CRYPTOCAP:USDC.D')
) as source(instrument_key, canonical_venue, canonical_ticker)
where registry.instrument_key = source.instrument_key
  and (
    registry.ticker_verification_status = 'UNVERIFIED'
    or registry.canonical_venue is distinct from source.canonical_venue
    or registry.canonical_ticker is distinct from source.canonical_ticker
  );

do $$
begin
  if (
    select count(*)
    from public.instrument_registry
    where (instrument_key, canonical_venue, canonical_ticker, ticker_verification_status) in (
      ('BTC_D', 'CRYPTOCAP', 'CRYPTOCAP:BTC.D', 'VERIFIED'),
      ('USDT_D', 'CRYPTOCAP', 'CRYPTOCAP:USDT.D', 'VERIFIED'),
      ('USDC_D', 'CRYPTOCAP', 'CRYPTOCAP:USDC.D', 'VERIFIED')
    )
  ) <> 3 then
    raise exception 'AS1_DOMINANCE_CANONICAL_IDENTITY_V0_1 postcondition failed';
  end if;

  if (
    select count(*)
    from public.instrument_observation_registry
    where instrument_key in ('BTC_D', 'USDT_D', 'USDC_D')
      and timeframe in ('4H', '1D')
      and observation_status = 'PLANNED'
      and live_since is null
      and last_seen_at is null
  ) <> 6 then
    raise exception 'AS1_DOMINANCE_CANONICAL_IDENTITY_V0_1 changed observation availability unexpectedly';
  end if;
end;
$$;

commit;

