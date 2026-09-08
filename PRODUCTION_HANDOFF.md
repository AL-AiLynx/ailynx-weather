# AiLynx Weather production handoff

Production URL: https://ailynx-weather.vercel.app

## Main assets

| Asset | Display | Canonical ticker | Current state | Price label |
| --- | --- | --- | --- | --- |
| BTCUSD | BTCUSD | COINBASE:BTCUSD | LIVE | Current price (Coinbase public ticker) |
| XAUUSD | GOLD | OANDA:XAUUSD | PLANNED | Waiting; only call an AS1 close `Observed close` |
| DXY | DXY | CAPITALCOM:DXY | PLANNED | Waiting; only call an AS1 close `Observed close` |
| US100 | NASDAQ | SKILLING:US100 | PLANNED | Waiting; only call an AS1 close `Observed close` |

The current audit found valid BTC HORUS_A receipts, while XAUUSD, DXY, and US100 had no receipt matching their fixed profile/ticker allow-list. A non-BTC asset must not be marked LIVE until a matching `valid=true` receipt exists for that asset/timeframe.

## Public readers and Weather

- `as1-horus-read`: BTC HORUS_A multi-timeframe projection.
- `as1-validation-read`: BTC MAAT / MAAT2 validation projection.
- `as1-asset-read`: fixed four-asset HORUS_A projection; returns only bounded observation fields and rejects arbitrary assets.
- Weather Engine v0.1 provides BTC FULL scores only where HORUS + MAAT + MAAT2 are valid. Non-BTC stays CALCULATING until equivalent asset-local inputs exist.

HERO uses the selected asset. BTC shows Coinbase current price; an asset-local AS1 bar close is labelled `OBSERVED CLOSE`, never current price. The weather icon/background represents observation state, never price direction.

## Current blockers and next task

1. Deliver valid non-BTC AS1 receipts for the fixed source profiles, then re-audit `as1-asset-read` before enabling those assets.
2. Reconcile the existing remote Supabase migration history before applying the member/community migration; do not repair, reset, or force-pull it blindly.
3. Add official social URLs and Auth credentials only through the documented setup path.
