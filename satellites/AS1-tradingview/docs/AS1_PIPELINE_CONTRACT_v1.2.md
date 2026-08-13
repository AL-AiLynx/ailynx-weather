# AS1 TradingView Alert -> Supabase Contract v1.2

## Purpose and scope

v1.2 separates a reusable, multi-asset observation contract from AS1's current BTC-first runtime configuration. The active primary observation is `COINBASE:BTCUSD` (BTC base asset) through `CB_BTCUSD_SPOT_20260722_V1`; this does not make the schema BTC-only. Future assets extend the Registry and runtime profile, not the common envelope.

This revision is documentation, schema, registry, and examples only. It does not implement a Pine exporter, a Supabase Edge Function, webhook endpoint, or credentials.

## Three ownership boundaries

| Layer | Produces |
| --- | --- |
| TradingView Pine | chart facts, OHLCV, fixed profile code, session hint, sensor validity/flags, client event key, payload |
| Supabase Edge Function | schema/Registry validation, canonical regime and instrument metadata, `received_at`, delay/age/freshness, server dedup key, acceptance or quarantine |
| Fusion/assembler | `assembly_time`, latest accepted components, freshness-based layout status, visibility, alignment/conflict/missing lists |

`quality.freshness` is deliberately absent from the Raw Alert. Pine does not know server receipt or assembly time, so freshness is server-calculated only.

## Raw Alert envelope

Required top-level fields are `schema_version`, `satellite_id`, `platform`, `layout_id`, `observer`, `code_version`, `source_profile_code`, `instrument`, `session_hint`, `timing`, `bar`, `packet_type`, `confirmed`, `quality`, `client_event_key`, and `payload`. Fixed values are `as1.v1.2`, `AS1`, `TRADINGVIEW`, `BAR_CLOSE_SNAPSHOT`, and `true`; layouts are HORUS_A, HORUS_B, MAAT, and MAAT2.

`instrument` is closed (`additionalProperties: false`) and has ticker/venue/symbol/base/quote, `asset_class`, `market_type`, and contract metadata. Experimental instrument fields belong in optional `instrument.extensions`; they must not drive deduplication, validation, or fusion before formalization. Asset classes include CRYPTO, EQUITY, ETF, INDEX, FOREX, COMMODITY, FIXED_INCOME, FUND, OTHER, and UNKNOWN. Market types include SPOT, PERPETUAL, FUTURE, OPTION, INDEX, CFD, and UNKNOWN.

The contract metadata distinguishes perpetual contracts (no expiry) from continuous series (a stitched sequence of dated contracts). It carries type, expiry, settlement/multiplier, continuous/adjustment, and roll state/event. Session hints are observations, not authoritative exchange calendars: `session_type`, `session_state`, and `is_market_open` are checked against Registry policy later.

`bar.volume` may be number or null; null requires `MISSING_VOLUME`. Units are BASE_ASSET, QUOTE_ASSET, CONTRACTS, or UNKNOWN. Bases are EXCHANGE_NATIVE, BASE_NORMALIZED, QUOTE_NOTIONAL, RELATIVE_NORMALIZED, or UNKNOWN. Price and volume are comparable only inside their respective comparison groups.

Pine builds only `client_event_key`: `satellite_id|layout_id|ticker_id|timeframe|bar_close_time|schema_version`. The Edge Function derives the authoritative `dedup_key`: `satellite_id|layout_id|canonical_regime_id|timeframe|bar_close_time|source_schema_version`.

## Registry and server validation

Pine sends a registered `source_profile_code`, never a free-form regime ID. The server checks existence, status, ticker/venue/symbol/assets, asset/market type, contract, volume semantics, session hint, and effective window; then attaches `canonical_regime_id`. `VALID`, `WARN`, and `REJECT` are distinct outcomes. Unknown/disabled/mismatched/out-of-window data is rejected and sent to quarantine/error ledger, never to normal latest state. A DATE_ONLY boundary adds `REGIME_BOUNDARY_DATE_ONLY` as a warning, not an automatic rejection.

## Normalized Observation and Fusion Snapshot

The normalized object records raw event identity plus Registry snapshot, canonical regime, server evaluation, and server dedup key. Its freshness is FRESH, AGING, or STALE. Fusion is not a Raw Alert: it is assembled at `assembly_time` from accepted normalized observations. Component states include layout, ticker, canonical regime, timeframe/bar close, receipt/age, quality/freshness/validity, and dedup key. Fusion status is ALIGNED, MIXED, CONFLICT, or INSUFFICIENT, with stale/conflicting/missing layouts. Different canonical regimes must not be directly price- or volume-compared; use only the active profile, mark INSUFFICIENT, or add `REGIME_MIXED_COMPONENTS`.

## Current and legacy BTC profiles

Coinbase BTCUSD is CRYPTO/SPOT, USD-settled `NONE` contract, BASE_ASSET/EXCHANGE_NATIVE volume. Legacy OKX BTCUSDT.P is CRYPTO/PERPETUAL, USDT-settled LINEAR contract, CONTRACTS/EXCHANGE_NATIVE volume. They therefore have separate price and volume comparison groups and must not be auto-joined. The transition has only Seoul local dates: legacy ends 2026-07-21 and Coinbase starts 2026-07-22; no invented UTC switch instant is permitted.

## v1.1 -> v1.2

1. Adds multi-asset `asset_class` and `market_type`.
2. Adds closed contract metadata and roll/adjustment flags.
3. Adds `session_hint`.
4. Removes Pine freshness.
5. Replaces free-form `source_regime_id` with Registry-backed `source_profile_code`.
6. Separates client event key from server dedup key.
7. Adds normalized observation as the server boundary.
8. Formalizes Raw/Normalized/Fusion as three objects.
9. Adds Registry status, quarantine, and boundary warnings.
10. Adds explicit volume basis and comparison groups.
11. Records OKX as historical perpetual, not a continuation of Coinbase spot.
12. Separates BTC runtime defaults from the general contract.

SESHAT validation consumes accepted normalized observations; it must respect Registry comparison boundaries. Current Pine `archive` and `current` source files remain untouched.
