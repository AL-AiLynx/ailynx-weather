# AS1 Source Profile Registry v1.2

The Registry is the server-owned directory that turns a Pine `source_profile_code` into canonical regime and instrument meaning. It prevents arbitrary strings from silently entering the observation stream.

Current profile: `CB_BTCUSD_SPOT_20260722_V1`, canonical ID `coinbase-btcusd-spot-regime-001`, ACTIVE, `COINBASE:BTCUSD`, CRYPTO/SPOT, BTC/USD, BASE_ASSET and EXCHANGE_NATIVE volume. Historical profile: `OKX_BTCUSDT_PERP_LEGACY_V1`, canonical ID `okx-btcusdt-perp-regime-001`, HISTORICAL, `OKX:BTCUSDT.P`, CRYPTO/PERPETUAL, BTC/USDT, LINEAR and CONTRACTS/EXCHANGE_NATIVE volume.

The known boundary is date-only in `Asia/Seoul`: OKX through 2026-07-21 and Coinbase from 2026-07-22. Exact UTC instants are null by design. Until supplied authoritatively, validation adds `REGIME_BOUNDARY_DATE_ONLY`; it does not fabricate a switch time.

Server order: resolve code; check usable status; match ticker/venue/symbol/assets; match class/market/contract; match volume unit/basis; check session policy; check effective window; add date-only warning; attach canonical regime; derive dedup key. `VALID` accepts, `WARN` accepts with flags, and `REJECT` sends the event to quarantine/error ledger rather than latest state. Typical reject codes are UNKNOWN_SOURCE_PROFILE, PROFILE_DISABLED, PROFILE_TICKER_MISMATCH, PROFILE_VENUE_MISMATCH, PROFILE_ASSET_CLASS_MISMATCH, PROFILE_MARKET_TYPE_MISMATCH, PROFILE_CONTRACT_MISMATCH, PROFILE_VOLUME_UNIT_MISMATCH, PROFILE_SESSION_MISMATCH, and REGIME_OUT_OF_WINDOW.

Future exact transition timestamps may replace null UTC bounds and DATE_ONLY precision without changing the envelope format.
