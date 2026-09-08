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

## Multi-Asset Read Path v0.1 — 2026-09-08

### What changed

- `asset-read-path.js` is the single owner for selected non-BTC observation reads. A new selection clears the old observation immediately, aborts the prior request, and accepts a response only when its selection token and asset identity still match.
- `as1-asset-client.js` now validates the response's top-level asset/ticker/profile and every projected receipt's asset, symbol, ticker, timeframe, timestamp, close, validity, freshness, and flags. A mismatched or malformed receipt fails closed as `IDENTITY_MISMATCH`.
- The HERO and observed-market cards show the selected canonical ticker, entitlement, observation availability, and receipt presence. Non-BTC displays an AS1 `Observed close` only; it cannot use the Coinbase BTC price fallback.
- Locked assets do not issue an observation request and expose no cached receipt to the DOM path. Weather Engine calculations remain BTC-only and were not changed.

### BTC-only hard-coding removed from the read path

The selected asset is now passed to `as1-asset-read` through the fixed registry and is checked again in its returned receipt. The remaining BTC-only paths are intentional: Coinbase spot-price polling, HORUS/MAAT/MAAT2 projections, and Weather Engine v0.1 have BTC-only production contracts.

### Safety and test result

- Cross-asset response, malformed nested receipt, stale response, sequential BTC/XAUUSD/DXY/US100 switching, no-data/PLANNED, and locked receipt exposure are covered by Weather tests.
- `node --test Weather/tests/*.test.mjs`: 38 passed, 0 failed.
- `node --check Weather/app.js` and `git diff --check`: passed.

### Production receipt gate

XAUUSD, DXY, and US100 remain `PLANNED`. Promote a non-BTC timeframe to `LIVE` only after `as1-asset-read` returns an asset-local receipt with the exact canonical ticker/profile and `valid=true`; no BTC data may be used as a substitute.

## Phase 2 — Production receipt readiness and frontline UI (2026-09-08)

### Production verification

The public `as1-asset-read` endpoint was read without modifying production data or registry state. It returned the exact canonical ticker/profile pairs for all four assets:

| Asset | Receipt result | Readiness state |
| --- | --- | --- |
| BTCUSD | valid receipts present; 4H `AGING`, 1D `STALE` in this read | asset remains LIVE; stale timeframe is displayed as stale |
| XAUUSD | no latest receipt; no timeframes | PLANNED |
| DXY | no latest receipt; no timeframes | PLANNED |
| US100 | no latest receipt; no timeframes | PLANNED |

The browser client treats a timeframe as `LIVE` only when its selected asset's bounded receipt has the exact identity already verified by the reader, is `valid=true`, and is not stale. Cross-asset, mismatched-profile, invalid, stale, locked, and no-data paths do not promote to LIVE.

### Frontline UI

- Added the `주요 우선 타임프레임` strip directly below the HERO card.
- The strip renders asset-local 1H, 2H, 4H, 6H, 8H, 12H, and 1D nodes with a responsive horizontal overflow path.
- The selected validation candidate is highlighted as `PRIORITY`; every node independently renders `LIVE`, `WAITING`, `PLANNED`, `STALE`, `INVALID`, `NO DATA`, or `LOCKED`.
- No price, receipt, or BTC fallback is rendered for a locked asset. The component is state visualization only; Weather Engine calculations remain unchanged.

### Validation

- Existing and new Weather tests: 43 passed, 0 failed.
- The new coverage verifies BTC status mapping, non-BTC PLANNED isolation, asset-local LIVE mapping, stale-receipt non-promotion, locked exposure, and frontline DOM/CSS integration.

## Weather Persistence & Change Rate v0.1 (2026-09-08)

### Definitions and inputs

Weather Persistence expresses how consistently the current observation-aligned weather state is holding. Weather Change Rate expresses only the absolute pace and magnitude of change since the immediately prior observation; it is not direction, buy/sell strength, or a forecast.

For the selected BTC asset, the browser records at most four same-timeframe runtime snapshots. Each snapshot uses the validated FULL Weather Score, classified weather state, active major timeframe, HORUS quality/freshness, MAAT conflict count, and HORUS receipt timestamp. A repeated timestamp replaces the current snapshot rather than manufacturing history.

### v0.1 calculation

- Persistence: score stability 40%, weather-state stability 25%, major-timeframe stability 20%, quality continuity 15%.
- Change Rate: absolute score delta 50%, weather-state transition 25%, major-timeframe transition 15%, quality/freshness adjustment 10%.
- Both metrics are rounded and bounded to 0–100. Persistence labels are `VERY STRONG`, `STRONG`, `MODERATE`, `WEAK`, and `VERY WEAK`; Change Rate labels are `VERY CALM`, `CALM`, `MODERATE`, `FAST`, and `VERY FAST`.

### Fail-closed behavior

No numeric metric is shown without a prior valid same-asset, same-timeframe observation. Stale, invalid, cross-asset, PLANNED, NO_DATA, and LOCKED paths return the existing waiting/status UI instead. Non-BTC never receives BTC metrics as a fallback.

This is an initial state-indicator implementation. SESHAT data, once available, may be used for later calibration; it is not required for v0.1 and was not added to the frontend.

### Validation

- Existing and new Weather tests: 49 passed, 0 failed.
- Coverage includes stable repeated observations, score shock, weather transition, major timeframe transition, quality penalty, data insufficiency, stale/invalid/cross-asset rejection, and bounds.

## PWA UI Stabilization + Weather Metrics Activation + Frontline v0.2 (2026-09-08)

### Clock stabilization

- The header clock now renders `YYYY.MM.DD · HH:MM` only and refreshes once per minute.
- Tabular numerals and a reserved desktop width prevent minute transitions from shifting adjacent header content. The compact mobile rule retains a reserved clock width.

### Persistence and Change Rate activation

- The prior `Waiting` behavior after a browser reload was caused by history existing only in a runtime `Map`; the valid prior observation disappeared at reload, leaving fewer than two snapshots.
- The browser now stores no more than four minimal validated snapshots in `localStorage`, partitioned by `assetId` and `timeframe` under `lynx.weather.history.<asset>.<timeframe>`. Stored fields are score, state, major timeframe, quality, freshness, validity, and observation timestamp; raw receipts and payloads are not stored.
- Only two or more valid, fresh/aging, same-asset, same-timeframe snapshots calculate a numeric metric. Stale, invalid, PLANNED, NO_DATA, LOCKED, malformed, or cross-asset history fails closed to the existing status UI.
- Persistence labels are now `매우 강함`, `강함`, `보통`, `약함`, and `매우 약함`. Change Rate labels are `매우 빠름`, `빠름`, `보통`, `안정`, and `매우 안정`.
- Non-BTC assets still cannot inherit BTC Weather Engine values or history.

### Frontline and PWA cache

- The verified section heading is `주요 우선 타임프레임`; its asset-local nodes are 1H, 2H, 4H, 6H, 8H, 12H, and 1D. The chosen active timeframe is highlighted and the strip keeps its horizontal-overflow behavior on narrow screens.
- The service-worker cache was incremented to `ailynx-weather-v29`, and the app shell now precaches the history module and `app.js?v=24`.

### Deployment boundary

This repository contains no `vercel.json` or other Vercel project configuration that identifies a deployed repository, production branch, or root directory. The older handoff text references a separate `ailynx-weather` repository on `main`, so it cannot establish that this monorepo's `integration/as1-live-v1` branch with `Weather/` root is deployed. No Vercel setting was changed; verify that mapping in the Vercel project before release.

## PWA Visual Refinement v0.3 (2026-09-08)

- The local timestamp is part of the left brand block below the product subtitle. It remains minute-based, tabular, and has a reserved line height, so clock updates do not move right-side controls.
- User-facing metric terminology is `날씨 지속력` and `날씨 변화율`. Insufficient history uses `관측 축적 중`; user-facing `Waiting` is replaced with `관측 대기` without altering the internal status codes.
- `현재 리더 타임프레임` uses the already verified MAAT/HORUS observation context, falling back only to the selected validation timeframe. `타임프레임 우선` keeps the asset-local 1H–1D strip and marks that selected leader as `리더`. The lower-timeframe note is deliberately observational, not a prediction claim.
- `날씨 흐름` is a dependency-free SVG curve over no more than four valid FRESH/AGING observations from the same selected asset and timeframe. It never combines cross-asset history; fewer than two valid observations render `최근 관측 기록을 모으는 중` instead of fabricating a line.
- Service-worker cache `ailynx-weather-v31` precaches the dynamics module, `styles.css?v=24`, `app.js?v=25`, `i18n.js?v=3`, and `frontline-timeframe.js?v=2` so user-facing terminology and the leader label cannot reuse their older cached modules.
