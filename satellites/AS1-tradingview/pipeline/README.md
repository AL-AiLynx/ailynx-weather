# AS1 TradingView -> Supabase Pipeline

The active Raw Alert wire contract is **as1.v1.4**. It additively promotes MAAT validation, MAAT2 Hub, and MAAT2 Time packets while preserving **as1.v1.3** as the frozen Normalized/Fusion baseline. The v1-v1.2 files remain historical regression targets.

## Current operating profile

- Primary asset: BTC
- Active source profile: `CB_BTCUSD_SPOT_20260722_V1`
- Active ticker: `COINBASE:BTCUSD` (Coinbase BTC/USD spot)
- Historical profile: `OKX_BTCUSDT_PERP_LEGACY_V1` (OKX BTC/USDT perpetual)
- Runtime mode: `SINGLE_PRIMARY_ASSET`; the common schema is multi-asset ready.

Coinbase spot and legacy OKX perpetual must not be automatically price- or volume-compared. Their Registry comparison groups are separate.

## Current implementation status

This repository contains the v1.4 Raw schema, compatibility policy, executable examples, MAAT/MAAT2 Pine export blocks, a read-only Supabase Edge Function, and additive PWA cards. Export inputs default to OFF. No TradingView Alert, webhook, production deployment, credential, historical-row rewrite, or live row is created by this revision.

- Raw Alert contract = `as1.v1.4`
- Normalized/Fusion baseline = `as1.v1.3` (FROZEN)
- Accepted live Raw versions = `as1.v1.3`, `as1.v1.4`
- Layout/observer/packet matrix validation = PASS
- Same-bar packet key separation = PASS
- Prediction and automatic HIT/MISS suppression = PASS
- v1.3 fixture and v1.2 legacy regression = PASS
- MAAT/MAAT2 Pine export code = IMPLEMENTED, DEFAULT OFF
- Supabase validation read function = IMPLEMENTED, NOT DEPLOYED
- PWA validation cards = IMPLEMENTED, NOT DEPLOYED
- TradingView Alert/webhook/live ingest = NOT ACTIVATED

## v1.4 Raw promotion files

- `schema/as1-alert-envelope-v1.4.json` — packet-specific Raw envelope
- `schema/as1-ingest-policy-v1.4.json` and `config/as1-ingest-policy-v1.4.json` — additive live compatibility
- `examples/*-envelope-v1.4.json` — MAAT, MAAT2 Hub, and MAAT2 Time examples
- `mappings/*-field-map-v1.4.json` — exporter field ownership
- `tests/validate-v1.4-alerts.py` — schema, matrix, key, and forbidden-semantics checks
- `../docs/AS1_MAAT_MAAT2_ALERT_CONTRACT_v1.4.md`

## Preserved v1.3 baseline

- `schema/*-v1.3.json` — common, Raw, Normalized, Fusion, Registry, and ingest-policy schemas
- `config/*-v1.3.json` — Registry, runtime defaults, and protocol compatibility
- `tests/fixtures/v1.3/AS1_V13_*.json` — NORMAL, CLOSED, MISSING, and ROLL fixtures
- `tests/fixtures/v1.3/fixture-source-profile-registry-v1.3.json` — test-only profile authority
- `tests/validate-v1.3-fixtures.py` and `tests/audit-v1.2-known-issues.py`
- `examples/*-v1.3.json` and `mappings/horus-a-field-map-v1.3.json`
- `../docs/*v1.3.md` and `../docs/AS1_VISIBILITY_FORMULA_V1.md`
