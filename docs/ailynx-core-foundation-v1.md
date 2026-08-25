# AiLynx Core Foundation v1

## Status and scope

AiLynx Core is the permanent ledger for observations, source evidence, and delivery health across the satellite system. Foundation v1 defines the private database structure in a Git migration. It does not expose an API, create storage buckets, deploy an Edge Function, alter TradingView alerts, or apply anything to a Supabase database.

The migration in `supabase/migrations/20260825105521_ailynx_core_foundation_v1.sql` is the schema source of truth. Dashboard edits are not a substitute for a reviewed Git migration.

Foundation v1 creates these private schemas:

- `lynx_registry`: satellites, sensors, and source-profile identities
- `lynx_ingest`: source envelopes preserved on arrival
- `lynx_core`: canonical observations shared by live and historical analysis
- `lynx_archive`: provenance for source assets
- `lynx_ops`: delivery and source-health events
- `lynx_ledger`: logical live/history views
- `lynx_derived`: current-state projections

No ledger table or view is created in `public`.

## Registry model

`lynx_registry.satellites` reserves stable identities for the three source families:

| Satellite | Name | Platform | Foundation v1 contents |
| --- | --- | --- | --- |
| `AS1` | TradingView | `TRADINGVIEW` | Satellite plus the four established AS1 sensor identities |
| `AS2` | TrendSpider | `TRENDSPIDER` | Satellite identity only |
| `AS3` | OpenMarket | `OPENMARKET` | Satellite identity only |

The AS1 sensors are `AS1_HORUS_A`, `AS1_HORUS_B`, `AS1_MAAT`, and `AS1_MAAT2`. Foundation v1 deliberately does not invent AS2 or AS3 sensor names before their contracts are settled.

`lynx_registry.source_profiles` defines the durable shape for later source-profile registration. Legacy profile values are not guessed or seeded into the new Core.

## Raw events and canonical observations

`lynx_ingest.raw_events` is append-first evidence. It retains the original JSON envelope alongside indexed routing, timing, bar, quality, and provenance fields. A raw row states what arrived; normalization must not rewrite that evidence.

`lynx_core.observations` is the long-term canonical comparison ledger. It may reference a raw event, an archived source asset, or both. Normalized fields support cross-source queries while `normalized_payload` carries the complete canonical result.

Corrections are append-only. When a past observation needs correction, a new row can point to the earlier row through `supersedes_observation_id` and explain the change in `revision_reason`. The old row remains available for audit.

### Immutable ledger discipline

`raw_events` is an append-first raw ledger, and `observations` is the canonical normalized ledger. Neither is a mutable current-state cache. Historical facts should not be overwritten with an unconditional `UPDATE`. A correction should normally be a new observation linked through `supersedes_observation_id` and explained by `revision_reason`, preserving the full correction chain.

`delivery_events` is also historical evidence. Successful and failed attempts remain in the ledger; operators must not delete or rewrite failed delivery rows to improve apparent success rates. Derived reports may classify or exclude known test traffic without destroying its source history.

## One ledger for LIVE and HISTORY

LIVE and HISTORY are not stored in duplicate physical tables. Both belong to the same canonical observation history and must follow the same identity, quality, and correction rules. Duplicating them would invite schema drift and make comparison harder.

`lynx_ledger.live_observations` selects rows whose `ingestion_mode` is `LIVE`. `lynx_ledger.history_observations` selects every non-LIVE mode. These are logical views over `lynx_core.observations`; they do not copy data.

The modes mean:

- `LIVE`: an observation received through the active operational path
- `BACKFILL`: historical coverage filled by a controlled automated process
- `MANUAL_HISTORY`: historical evidence entered through an explicitly supervised process
- `REPLAY`: a previously captured event processed again for testing or reconstruction
- `IMPORT`: records brought in from another managed dataset

## Observation time and ingestion time

`observed_at` is when the market or source condition existed. `ingested_at` is when AiLynx committed the canonical row. They differ during delayed delivery, backfill, replay, or manual history work. Analysis orders market facts by observation time; operations and audit trails also need ingestion time.

For raw events, `received_at` records arrival at the ingest boundary and `source_sent_at` can record the sender's transmission time. Keeping these clocks separate prevents delivery latency from being mistaken for market time.

For example, if a TradingView screenshot captured on 2026-07-20 is entered on 2026-09-01, `observed_at` is the actual capture time on 2026-07-20, `ingested_at` is the load time on 2026-09-01, and `ingestion_mode` is `BACKFILL` or `MANUAL_HISTORY`. A historical screenshot, CSV, document, or conversation must never be relabeled as current `LIVE` data merely because it was ingested today.

## Bar kinds and partial observations

The supported bar kinds are:

- `FULL`: a complete nominal bar
- `STUB`: a deliberately short boundary bar
- `SESSION_PARTIAL`: a bar shortened by a session boundary
- `IRREGULAR`: a validly observed bar whose duration does not match the ordinary schedule
- `UNKNOWN`: the producer or normalizer cannot classify it safely

`FULL` and `STUB` must not be inferred from payload size. They describe time coverage. `nominal_timeframe_minutes` records the expected duration and `actual_bar_minutes` records observed coverage so later validation can distinguish a normal full bar from an intentional stub.

## Idempotency

`client_event_key` is the authoritative webhook duplicate key when it is present. A partial unique index on `lynx_ingest.raw_events(client_event_key)` enforces uniqueness only for non-null values. Null remains allowed for evidence that predates the key or arrives through a workflow without one.

`event_uuid` is the unique AiLynx Core identity for a raw event. It is independent of `client_event_key`: the former identifies the Core row, while the latter provides source-facing idempotency when a producer supplies a stable key.

`observation_key` follows the same nullable partial-unique pattern for canonical observations. It does not replace correction lineage: a correction is a new row with its own identity and an optional `supersedes_observation_id` reference.

## Archive provenance

`lynx_archive.source_assets` tracks screenshots, CSV files, documents, Alert JSON, conversations, URLs, and other original evidence. It records where an asset came from, its optional hash and observed interval, and where an external storage object may later live.

Foundation v1 creates no Supabase Storage bucket and stores no file bytes. The table is provenance, not storage provisioning.

## Delivery operations

`lynx_ops.delivery_events` records expected deliveries, receipts, timeouts, DNS or HTTP failures, duplicates, rejections, and unknown outcomes. This separates two operationally different situations:

- the market or upstream source produced no new observation;
- the sensor or transport path failed to deliver an expected observation.

Rows may link back to `raw_events` when a delivery produced ingest evidence. They can also exist without a raw row when transport failed before ingest.

`route_code` identifies the delivery path, such as a legacy ingress, Core route, diagnostic probe, or future relay. It is intentionally open text rather than a fixed enum. `attempt_no` is a positive integer identifying successive attempts on the relevant logical delivery path.

## Live and historical provenance paths

Foundation v1 supports two independent evidence paths:

- A live sensor envelope can create `raw_events`, followed by an `observations` row that references it through `raw_event_id`.
- A historical screenshot, conversation, CSV, or document can create `source_assets`, followed by an `observations` row with `raw_event_id = NULL` and a non-null `source_asset_id`.

Historical assets are not forced through a fabricated raw sensor event. Both references remain nullable because an observation can be normalized from either source class; ingest policy and validation decide which provenance is required for a particular workflow.

The common ledger is not TradingView- or BTC-specific. Fields such as `ticker_id`, `venue`, `symbol`, `timeframe`, `bar_open_time`, and `bar_close_time` are nullable where they occur. AS2 macro, event, news, or fundamental observations and AS3 sources can therefore represent non-bar data without inventing market-bar values. Sensor-specific columns remain deferred to later contracts.

## Latest sensor state

`lynx_derived.latest_sensor_state` returns one current LIVE primary observation for each `(satellite_id, sensor_id, ticker_id, timeframe)` group. Ordering is by `observed_at`, then `ingested_at`, with `observation_id` as a deterministic tie-breaker.

The view does not filter to `GOOD` only. A `WATCH` or `CONFLICT` row may be the most important description of the sensor's current state.

PostgreSQL views normally use view-owner privilege semantics unless deliberately configured otherwise. These views remain in private schemas with direct `PUBLIC`, `anon`, and `authenticated` access revoked. Any later PWA or API exposure must explicitly choose a `security_invoker` view design or a narrow Edge Function/RPC boundary; moving a current view into a public API surface is not sufficient security design.

## Private-by-default security

Foundation v1 creates no table in `public`, explicitly revokes schema, table/view, sequence, and function privileges from `PUBLIC`, `anon`, and `authenticated`, and defines no public RLS or API policy. The revokes do not target `postgres` or `service_role`, preserving controlled server-side operation. Custom schemas remain outside the exposed public API surface unless a later, reviewed migration deliberately changes that boundary.

The intended later access path is a controlled server component or narrow RPC into the private ledger. API views, production ingest functions, PWA reads, and public policies require separate contracts and migrations.

## Deferred work

Foundation v1 intentionally does not create PWA APIs, public views, `weather-read`, a production AS1 ingest function, Storage buckets, SESHAT validation tables, weather snapshots, macro calculation tables, source-specific AS2/AS3 tables, Discord tables, or YouTube tables.

The diagnostic `tv-webhook-probe` source may be preserved unchanged when it exists in the canonical source tree. It is not present at this foundation's base commit, so Foundation v1 does not synthesize a replacement. No probe or other function is deployed by this work.

## Change and deployment discipline

The Git migration is the canonical design artifact. This phase performs static review only; it does not link a Supabase project, run SQL in the Dashboard, push or apply migrations, invoke `psql`, or deploy a function. Database application and the design of controlled access are separate reviewed phases.
