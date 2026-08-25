begin;

-- gen_random_uuid() is used for durable public identifiers. Supabase manages the
-- extensions schema; IF NOT EXISTS keeps the declaration safe on repeat checks.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists lynx_registry;
create schema if not exists lynx_ingest;
create schema if not exists lynx_core;
create schema if not exists lynx_archive;
create schema if not exists lynx_ops;
create schema if not exists lynx_ledger;
create schema if not exists lynx_derived;

create function lynx_registry.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table lynx_registry.satellites (
    satellite_id text primary key,
    name text not null,
    platform text not null,
    description text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger satellites_set_updated_at
before update on lynx_registry.satellites
for each row
execute function lynx_registry.set_updated_at();

create table lynx_registry.sensors (
    sensor_id text primary key,
    satellite_id text not null
        references lynx_registry.satellites (satellite_id),
    name text not null,
    observer text,
    layout_id text,
    description text,
    active boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger sensors_set_updated_at
before update on lynx_registry.sensors
for each row
execute function lynx_registry.set_updated_at();

create table lynx_registry.source_profiles (
    source_profile_code text primary key,
    satellite_id text not null
        references lynx_registry.satellites (satellite_id),
    sensor_id text
        references lynx_registry.sensors (sensor_id),
    name text not null,
    asset_class text,
    ticker_id text,
    venue text,
    symbol text,
    active boolean not null default true,
    valid_from timestamptz,
    valid_to timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

insert into lynx_registry.satellites (
    satellite_id,
    name,
    platform,
    description
)
values
    ('AS1', 'TradingView', 'TRADINGVIEW', 'TradingView sensor satellite'),
    ('AS2', 'TrendSpider', 'TRENDSPIDER', 'TrendSpider sensor satellite'),
    ('AS3', 'OpenMarket', 'OPENMARKET', 'OpenMarket sensor satellite')
on conflict (satellite_id) do nothing;

insert into lynx_registry.sensors (
    sensor_id,
    satellite_id,
    name
)
values
    ('AS1_HORUS_A', 'AS1', 'HORUS A'),
    ('AS1_HORUS_B', 'AS1', 'HORUS B'),
    ('AS1_MAAT', 'AS1', 'MAAT'),
    ('AS1_MAAT2', 'AS1', 'MAAT2')
on conflict (sensor_id) do nothing;

create table lynx_archive.source_assets (
    asset_id uuid primary key default gen_random_uuid(),
    asset_type text not null,
    original_filename text,
    source_room text,
    source_reference text,
    storage_bucket text,
    storage_path text,
    sha256 text,
    observed_from timestamptz,
    observed_to timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    ingested_at timestamptz not null default now(),
    constraint source_assets_asset_type_check check (
        asset_type in (
            'SCREENSHOT',
            'CSV',
            'DOCUMENT',
            'ALERT_JSON',
            'CONVERSATION',
            'URL',
            'OTHER'
        )
    )
);

create table lynx_ingest.raw_events (
    id bigint generated always as identity primary key,
    event_uuid uuid not null default gen_random_uuid(),
    received_at timestamptz not null default now(),
    source_sent_at timestamptz,
    observed_at timestamptz,
    schema_version text not null,
    satellite_id text not null
        references lynx_registry.satellites (satellite_id),
    sensor_id text
        references lynx_registry.sensors (sensor_id),
    source_profile_code text
        references lynx_registry.source_profiles (source_profile_code),
    platform text,
    ticker_id text,
    venue text,
    symbol text,
    timeframe text,
    nominal_timeframe_minutes integer,
    bar_open_time timestamptz,
    bar_close_time timestamptz,
    actual_bar_minutes numeric,
    bar_kind text,
    ingestion_mode text not null,
    is_primary_observation boolean not null default true,
    client_event_key text,
    quality jsonb not null default '{}'::jsonb,
    payload jsonb not null default '{}'::jsonb,
    raw_envelope jsonb not null,
    source_asset_id uuid
        references lynx_archive.source_assets (asset_id),
    created_at timestamptz not null default now(),
    constraint raw_events_event_uuid_key unique (event_uuid),
    constraint raw_events_bar_kind_check check (
        bar_kind in ('FULL', 'STUB', 'SESSION_PARTIAL', 'IRREGULAR', 'UNKNOWN')
    ),
    constraint raw_events_ingestion_mode_check check (
        ingestion_mode in ('LIVE', 'BACKFILL', 'MANUAL_HISTORY', 'REPLAY', 'IMPORT')
    )
);

create unique index raw_events_client_event_key_uidx
    on lynx_ingest.raw_events (client_event_key)
    where client_event_key is not null;

create index raw_events_received_at_idx
    on lynx_ingest.raw_events (received_at desc);

create index raw_events_observed_at_idx
    on lynx_ingest.raw_events (observed_at desc);

create index raw_events_satellite_sensor_observed_at_idx
    on lynx_ingest.raw_events (satellite_id, sensor_id, observed_at desc);

create index raw_events_ticker_timeframe_observed_at_idx
    on lynx_ingest.raw_events (ticker_id, timeframe, observed_at desc);

create index raw_events_ingestion_mode_observed_at_idx
    on lynx_ingest.raw_events (ingestion_mode, observed_at desc);

create table lynx_core.observations (
    observation_id uuid primary key default gen_random_uuid(),
    observation_key text,
    raw_event_id bigint
        references lynx_ingest.raw_events (id),
    source_asset_id uuid
        references lynx_archive.source_assets (asset_id),
    satellite_id text not null
        references lynx_registry.satellites (satellite_id),
    sensor_id text
        references lynx_registry.sensors (sensor_id),
    source_profile_code text
        references lynx_registry.source_profiles (source_profile_code),
    observed_at timestamptz not null,
    ingested_at timestamptz not null default now(),
    ingestion_mode text not null,
    ticker_id text,
    venue text,
    symbol text,
    timeframe text,
    nominal_timeframe_minutes integer,
    actual_bar_minutes numeric,
    bar_kind text,
    is_primary_observation boolean not null default true,
    state_code text,
    quality_status text not null default 'UNKNOWN',
    quality_flags text[] not null default '{}'::text[],
    normalized_payload jsonb not null default '{}'::jsonb,
    supersedes_observation_id uuid
        references lynx_core.observations (observation_id),
    revision_reason text,
    created_at timestamptz not null default now(),
    constraint observations_ingestion_mode_check check (
        ingestion_mode in ('LIVE', 'BACKFILL', 'MANUAL_HISTORY', 'REPLAY', 'IMPORT')
    ),
    constraint observations_bar_kind_check check (
        bar_kind in ('FULL', 'STUB', 'SESSION_PARTIAL', 'IRREGULAR', 'UNKNOWN')
    ),
    constraint observations_quality_status_check check (
        quality_status in ('GOOD', 'LIMITED', 'WATCH', 'CONFLICT', 'UNKNOWN')
    )
);

create unique index observations_observation_key_uidx
    on lynx_core.observations (observation_key)
    where observation_key is not null;

create index observations_observed_at_idx
    on lynx_core.observations (observed_at desc);

create index observations_satellite_sensor_observed_at_idx
    on lynx_core.observations (satellite_id, sensor_id, observed_at desc);

create index observations_ticker_timeframe_observed_at_idx
    on lynx_core.observations (ticker_id, timeframe, observed_at desc);

create index observations_ingestion_mode_observed_at_idx
    on lynx_core.observations (ingestion_mode, observed_at desc);

create table lynx_ops.delivery_events (
    delivery_id uuid primary key default gen_random_uuid(),
    provider text not null,
    satellite_id text
        references lynx_registry.satellites (satellite_id),
    sensor_id text
        references lynx_registry.sensors (sensor_id),
    endpoint_code text,
    route_code text,
    attempt_no integer not null default 1,
    client_event_key text,
    expected_at timestamptz,
    attempted_at timestamptz,
    received_at timestamptz,
    delivery_state text not null,
    http_status integer,
    latency_ms numeric,
    error_type text,
    error_message text,
    raw_event_id bigint
        references lynx_ingest.raw_events (id),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint delivery_events_attempt_no_check check (attempt_no > 0),
    constraint delivery_events_delivery_state_check check (
        delivery_state in (
            'EXPECTED',
            'RECEIVED',
            'TIMEOUT',
            'DNS_ERROR',
            'HTTP_ERROR',
            'DUPLICATE',
            'REJECTED',
            'UNKNOWN'
        )
    )
);

create index delivery_events_created_at_idx
    on lynx_ops.delivery_events (created_at desc);

create index delivery_events_state_created_at_idx
    on lynx_ops.delivery_events (delivery_state, created_at desc);

create index delivery_events_client_event_key_idx
    on lynx_ops.delivery_events (client_event_key);

create index delivery_events_satellite_sensor_created_at_idx
    on lynx_ops.delivery_events (satellite_id, sensor_id, created_at desc);

create index delivery_events_route_created_at_idx
    on lynx_ops.delivery_events (route_code, created_at desc);

create view lynx_ledger.live_observations as
select *
from lynx_core.observations
where ingestion_mode = 'LIVE';

create view lynx_ledger.history_observations as
select *
from lynx_core.observations
where ingestion_mode <> 'LIVE';

create view lynx_derived.latest_sensor_state as
select distinct on (satellite_id, sensor_id, ticker_id, timeframe) *
from lynx_core.observations
where ingestion_mode = 'LIVE'
  and is_primary_observation = true
order by
    satellite_id,
    sensor_id,
    ticker_id,
    timeframe,
    observed_at desc,
    ingested_at desc,
    observation_id desc;

comment on table lynx_ingest.raw_events is
    'Append-first ledger preserving the envelope received from a sensor.';

comment on table lynx_core.observations is
    'Canonical LIVE and historical observation ledger; corrections append rows and may reference superseded observations.';

comment on table lynx_archive.source_assets is
    'Provenance records for historical source material; storage objects are managed separately.';

comment on table lynx_ops.delivery_events is
    'Delivery-health ledger separating transport failures from quiet market data.';

-- Custom schemas are deliberately server-only in Foundation v1. Supabase's
-- server-side postgres and service_role ownership paths are not revoked.
revoke all privileges on schema
    lynx_registry,
    lynx_ingest,
    lynx_core,
    lynx_archive,
    lynx_ops,
    lynx_ledger,
    lynx_derived
from public, anon, authenticated;

revoke all privileges on all tables in schema
    lynx_registry,
    lynx_ingest,
    lynx_core,
    lynx_archive,
    lynx_ops,
    lynx_ledger,
    lynx_derived
from public, anon, authenticated;

revoke all privileges on all sequences in schema
    lynx_registry,
    lynx_ingest,
    lynx_core,
    lynx_archive,
    lynx_ops,
    lynx_ledger,
    lynx_derived
from public, anon, authenticated;

revoke all privileges on all functions in schema
    lynx_registry,
    lynx_ingest,
    lynx_core,
    lynx_archive,
    lynx_ops,
    lynx_ledger,
    lynx_derived
from public, anon, authenticated;

commit;
