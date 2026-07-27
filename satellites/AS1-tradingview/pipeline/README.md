# AS1 TradingView -> Supabase Pipeline

The current contract is **as1.v1.2**. The v1 and v1.1 files remain preserved as historical records and migration references.

## Current operating profile

- Primary asset: BTC
- Active source profile: `CB_BTCUSD_SPOT_20260722_V1`
- Active ticker: `COINBASE:BTCUSD` (Coinbase BTC/USD spot)
- Historical profile: `OKX_BTCUSDT_PERP_LEGACY_V1` (OKX BTC/USDT perpetual)
- Runtime mode: `SINGLE_PRIMARY_ASSET`; the common schema is multi-asset ready.

Coinbase spot and legacy OKX perpetual must not be automatically price- or volume-compared. Their Registry comparison groups are separate.

## Current implementation status

This repository currently contains the v1.2 contract, schemas, Registry/runtime configuration, mappings, and illustrative examples. Pine Exporter integration, Supabase Registry storage, Edge Function validation, webhook delivery, and credentials are not implemented. The next implementation step is HORUS A exporter integration.

No Pine source under `archive` or `current` is modified by this revision.

## v1.2 files

- `schema/as1-alert-envelope-v1.2.json` — Raw TradingView Alert
- `schema/as1-normalized-observation-v1.2.json` — server-normalized observation
- `schema/as1-fusion-snapshot-v1.2.json` — assembly-time Fusion result
- `schema/as1-source-profile-registry-v1.2.json` — Registry file schema
- `config/source-profile-registry-v1.2.json` and `config/as1-runtime-profile-v1.2.json`
- `examples/*-v1.2.json` and `mappings/horus-a-field-map-v1.2.json`
- `../docs/AS1_PIPELINE_CONTRACT_v1.2.md`
