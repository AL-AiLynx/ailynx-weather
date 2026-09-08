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

## 2026-09-08 non-BTC receipt audit

### Production and repository

- Production: https://ailynx-weather.vercel.app
- Production clone: `C:\Lynx\GitHub\ailynx-weather`
- GitHub: `AL-AiLynx/ailynx-weather.git`, branch `main`
- Main assets: BTCUSD, XAUUSD, DXY, US100
- Public readers: `as1-horus-read`, `as1-asset-read`, `as1-validation-read`

### Receipt evidence and current status

The user-supplied 13:00 KST export reported eight new `COINBASE:BTCUSD` receipts with `valid=true` and `sensor_quality=GOOD`, and zero new valid XAUUSD, DXY, or US100 receipts. Its older non-BTC rows were reported as `valid=false` with `SOURCE_PROFILE_MISMATCH`.

The public `as1-asset-read` audit independently returned:

| Asset | Canonical ticker | Required source profile | Observation status |
| --- | --- | --- | --- |
| BTCUSD | COINBASE:BTCUSD | CB_BTCUSD_SPOT_20260722_V1 | LIVE |
| XAUUSD | OANDA:XAUUSD | OANDA_XAUUSD_CFD_V1 | PLANNED |
| DXY | CAPITALCOM:DXY | CAPITALCOM_DXY_CFD_V1 | PLANNED |
| US100 | SKILLING:US100 | SKILLING_US100_CFD_V1 | PLANNED |

Do not promote a non-BTC asset to LIVE without an asset-local receipt that matches its exact ticker/profile and has `valid=true`.

### Read-only cause audit

Confirmed from the checked-in code:

1. `asset-registry.js` and deployed `as1-asset-read` use the exact non-BTC ticker/profile pairs above. The projection rejects identity drift and only considers matching receipts.
2. The checked-in AS1 v1.3 source-profile registry contains an ACTIVE Coinbase BTCUSD profile and a historical OKX BTC profile only. It contains no XAUUSD, DXY, or US100 production profile. This is direct evidence for a profile-registry gap, and is consistent with the reported `SOURCE_PROFILE_MISMATCH` rows.
3. The checked-in current GENUT A source creates its alert-bus snapshot from `syminfo.tickerid` on `barstate.isconfirmed` and `barstate.isrealtime`. Its visible alert-bus JSON does not contain a `source_profile_code` field. That source is not proof of the currently installed TradingView alert; TradingView UI was intentionally not inspected or changed.
4. The checked-in ingest policy permits AS1 v1.3/v1.4 schemas, but the deployed `as1-ingest` validator implementation and current TradingView webhook URL are not present in this PWA repository. Their live configuration is therefore **UNRESOLVED**, not inferred.

### Expected next non-BTC receipt windows

The requested 4H/1D next-window calculation is **UNRESOLVED** for XAUUSD, DXY, and US100. No active canonical session calendar/timezone for their required profiles exists in the checked-in production source-profile registry. Do not borrow BTC's 24/7 schedule or guess market-session boundaries.

If the active TradingView alert is running on 4H or 1D, the GENUT A source supports bar-close snapshots only (`barstate.isconfirmed` and `barstate.isrealtime`), but the actual chart/session/alert settings must be verified separately before an expected receipt time can be claimed.

### Entitlement versus observation

FREE entitlement is `BTCUSD + US100`. This permits selecting NASDAQ/US100 in the UI; it does not claim that US100 has an observation. Until a matching valid receipt arrives, US100 remains `AVAILABLE TO PLAN / PLANNED DATA`, while XAUUSD and DXY remain paid-plan locked and PLANNED.

### Weather Engine point-in-time check

Public readers and Weather Engine v0.1 returned the following BTC FULL observations during this audit:

| Timeframe | Weather | Score |
| --- | --- | --- |
| 4H | CLOUDY | 45 |
| 8H | CLOUDY | 37 |
| 12H | PARTLY_CLOUDY | 52 |

These are observation-alignment results, not forecasts. Durability and change rate continue to wait for eligible same-timeframe history.

### UI, language, and member state

- Weather widget preserves selected-asset isolation: a non-BTC selection only reads that asset's bounded `as1-asset-read` response and does not fall back to BTC price/weather data.
- HERO has selected asset, current price/observed close, weather icon/state/score, main timeframe, durability, and change rate.
- EN is the default with a KO toggle; consumer-facing labels use the i18n formatter. The MANUAL dialog is available.
- MARKET ADVISORY is an intentional empty shell until a supported LIVE contract exists.
- Auth/community code is ready but disabled: `AUTH_GATE_READY_BUT_DISABLED`. The database migration remains unapplied because remote migration history must be reconciled first.

### History and external integrations

- `public.ailynx_history_packets`: 296 packets reported in the supplied handoff context. AS1 LIVE observations are separate.
- TrendSpider event ledger/webhook and CSV archive operate independently; no change was made here.

### Next task sequence

1. Establish approved active source-profile registry entries for XAUUSD, DXY, and US100.
2. Verify the deployed ingest validator, installed GENUT A alert payload, webhook destination, and session-aware 4H/1D schedules without changing them during the audit.
3. Wait for asset-local `valid=true` non-BTC bar-close receipts, then re-audit before changing PLANNED to LIVE.
4. Confirm the intended US100 Alert timeframe.
5. Build same-timeframe weather history before enabling durability/change-rate results.
6. Reconcile Auth migration history without reset, force-pull, or destructive repair.
