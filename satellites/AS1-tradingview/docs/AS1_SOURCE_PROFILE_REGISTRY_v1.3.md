# AS1 Source Profile Registry v1.3

The Registry is the canonical description of observation regimes, not a wire-protocol compatibility table. `profile_status` is the sole lifecycle authority; a service may derive `can_accept_live_ingest = profile_status == ACTIVE`.

Coinbase `CB_BTCUSD_SPOT_20260722_V1` remains ACTIVE and OKX `OKX_BTCUSDT_PERP_LEGACY_V1` remains HISTORICAL. Their DATE_ONLY boundaries and comparison groups are inherited from v1.2 without inventing UTC switch timestamps. They remain non-comparable by default.

Profiles declare orthogonal `asset_class` and `instrument_type`, contract defaults, calendar/timezone policy, comparison groups, and allowed layouts. Contract rollover does not rename a Source Profile: individual `contract_id`, `series_symbol`, expiry, adjustment, roll state, and server-created `series_segment_id` carry lifecycle identity.

Live protocol acceptance is defined separately by `as1-ingest-policy-v1.3.json`.
