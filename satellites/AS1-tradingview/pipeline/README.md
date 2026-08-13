# AS1 TradingView -> Supabase Pipeline

The current active design contract is **as1.v1.3**. The v1, v1.1, and v1.2 files remain preserved as historical records and regression targets.

## Current operating profile

- Primary asset: BTC
- Active source profile: `CB_BTCUSD_SPOT_20260722_V1`
- Active ticker: `COINBASE:BTCUSD` (Coinbase BTC/USD spot)
- Historical profile: `OKX_BTCUSDT_PERP_LEGACY_V1` (OKX BTC/USDT perpetual)
- Runtime mode: `SINGLE_PRIMARY_ASSET`; the common schema is multi-asset ready.

Coinbase spot and legacy OKX perpetual must not be automatically price- or volume-compared. Their Registry comparison groups are separate.

## Current implementation status

This repository contains the v1.3 contract, schemas, Registry/runtime/ingest configuration, mappings, and executable fixtures. Pine Exporter integration, TradingView Alert creation, Supabase Registry storage, Edge Function validation, live data storage, webhook delivery, and credentials are not implemented. The next step is **HORUS A Exporter patch design**.

- Active contract = `as1.v1.3`
- v1.3 hardening = applied
- Production/Test schema isolation = PASS
- Fixture registry validation = PASS
- Async MTF fixture validation = PASS
- Age recomputation = PASS
- Negative mutation tests = PASS
- Pine Exporter = NOT IMPLEMENTED
- TradingView Alert = NOT CREATED
- Supabase = NOT CONNECTED

No Pine source under `archive` or `current` is modified by this revision.

## v1.3 files

- `schema/*-v1.3.json` — common, Raw, Normalized, Fusion, Registry, and ingest-policy schemas
- `config/*-v1.3.json` — Registry, runtime defaults, and protocol compatibility
- `tests/fixtures/v1.3/AS1_V13_*.json` — NORMAL, CLOSED, MISSING, and ROLL fixtures
- `tests/fixtures/v1.3/fixture-source-profile-registry-v1.3.json` — test-only profile authority
- `tests/validate-v1.3-fixtures.py` and `tests/audit-v1.2-known-issues.py`
- `examples/*-v1.3.json` and `mappings/horus-a-field-map-v1.3.json`
- `../docs/*v1.3.md` and `../docs/AS1_VISIBILITY_FORMULA_V1.md`
