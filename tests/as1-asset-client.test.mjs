import assert from "node:assert/strict";
import test from "node:test";
import {fetchAssetHistory, fetchAssetObservations, lastKnownGoodState} from "../as1-asset-client.js";
import {ASSET_READERS} from "../asset-registry.js";

const response = (body, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => body});
test("multi-asset reader rejects cross-asset projections", async () => {
  const result = await fetchAssetObservations({asset: "XAUUSD", fetchImpl: async () => response({ok: true, asset: "XAUUSD", ticker_id: "COINBASE:BTCUSD", source_profile_code: "OANDA_XAUUSD_CFD_V1", timeframes: {}})});
  assert.deepEqual(result, {available: false, reason: "IDENTITY_MISMATCH"});
});
test("multi-asset reader accepts only its exact fixed identity", async () => {
  const result = await fetchAssetObservations({asset: "DXY", fetchImpl: async () => response({ok: true, asset: "DXY", ticker_id: "CAPITALCOM:DXY", source_profile_code: "CAPITALCOM_DXY_CFD_V1", status: "PLANNED", latest_receipt: null, timeframes: {}})});
  assert.equal(result.available, true); assert.equal(result.status, "PLANNED");
});
test("multi-asset reader fails closed for unsupported assets", async () => {
  assert.deepEqual(await fetchAssetObservations({asset: "EURUSD"}), {available: false, reason: "UNSUPPORTED_ASSET"});
});
test("single registry fixes the four canonical asset identities", () => {
  assert.deepEqual(Object.keys(ASSET_READERS), ["BTCUSD", "US100", "XAUUSD", "DXY"]);
  assert.equal(ASSET_READERS.US100.tickerId, "SKILLING:US100");
  assert.equal(ASSET_READERS.BTCUSD.requiredPlan, "FREE");
  assert.equal(ASSET_READERS.US100.requiredPlan, "FREE");
  assert.equal(ASSET_READERS.XAUUSD.requiredPlan, "WEATHER");
  assert.equal(ASSET_READERS.DXY.requiredPlan, "WEATHER");
});

test("a stale valid receipt is not promoted to LIVE", async () => {
  const result = await fetchAssetObservations({asset: "XAUUSD", fetchImpl: async () => response({ok: true, asset: "XAUUSD", ticker_id: "OANDA:XAUUSD", source_profile_code: "OANDA_XAUUSD_CFD_V1", status: "LIVE", latest_receipt: {asset: "XAUUSD", symbol: "XAUUSD", ticker_id: "OANDA:XAUUSD", timeframe: "4H", received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, bar_close: 3400, valid: true, sensor_quality: "GOOD", freshness: "STALE", flags: []}, timeframes: {"4H": {asset: "XAUUSD", symbol: "XAUUSD", ticker_id: "OANDA:XAUUSD", timeframe: "4H", received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, bar_close: 3400, valid: true, sensor_quality: "GOOD", freshness: "STALE", flags: []}}})});
  assert.equal(result.status, "STALE");
});

test("current and last-known-good timeframe reads remain distinct", async () => {
  const stale = {asset: "BTCUSD", symbol: "BTCUSD", ticker_id: "COINBASE:BTCUSD", timeframe: "4H", received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, bar_close: 78000, valid: true, confirmed: true, sensor_quality: "GOOD", freshness: "STALE", flags: [], score: 48};
  const fresh = {...stale, timeframe: "1H", received_at: "2026-09-09T00:00:00.000Z", bar_close_time: 1788912000000, freshness: "FRESH", score: 54};
  const result = await fetchAssetObservations({asset: "BTCUSD", fetchImpl: async () => response({ok: true, asset: "BTCUSD", ticker_id: "COINBASE:BTCUSD", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", status: "LIVE", latest_receipt: fresh, timeframes: {"1H": fresh, "4H": stale}, current_timeframes: {"1H": fresh}, last_known_good_timeframes: {"1H": fresh, "4H": stale}})});
  assert.equal(result.available, true);
  assert.deepEqual(Object.keys(result.currentTimeframes), ["1H"]);
  assert.deepEqual(Object.keys(result.lastKnownGoodTimeframes), ["1H", "4H"]);
  assert.equal(result.lastKnownGoodTimeframes["4H"].freshness, "STALE");
});

test("last-known-good labels never claim stale data is LIVE", () => {
  const receipt = {valid: true, receivedAt: "2026-09-08T20:00:00.000Z"};
  assert.equal(lastKnownGoodState(receipt, Date.parse("2026-09-09T00:00:00.000Z")), "LAST OBSERVATION");
  assert.equal(lastKnownGoodState(receipt, Date.parse("2026-09-11T00:00:00.000Z")), "OLD OBSERVATION");
});

test("US100 uses a deterministic recovered observation only after current and last-known-good are absent", async () => {
  const recovered = {asset: "US100", symbol: "US100", ticker_id: "SKILLING:US100", timeframe: "4H", received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, bar_close: 23000, confirmed: true, valid: true, sensor_quality: "GOOD", freshness: "STALE", flags: [], score: 61, provenance: "RECOVERED_HISTORY"};
  const result = await fetchAssetObservations({asset: "US100", fetchImpl: async () => response({ok: true, asset: "US100", ticker_id: "SKILLING:US100", source_profile_code: "SKILLING_US100_CFD_V1", status: "RECOVERED", latest_receipt: recovered, timeframes: {"4H": recovered}, current_timeframes: {}, last_known_good_timeframes: {}, recovered_timeframes: {"4H": recovered}})});
  assert.equal(result.status, "RECOVERED");
  assert.equal(result.recoveredTimeframes["4H"].score, 61);
  assert.equal(result.recoveredTimeframes["4H"].tickerId, "SKILLING:US100");
  assert.equal(result.recoveredTimeframes["4H"].provenance, "RECOVERED_HISTORY");
});

test("a new US100 LIVE receipt takes precedence over recovered history", async () => {
  const live = {asset: "US100", symbol: "US100", ticker_id: "SKILLING:US100", timeframe: "4H", received_at: "2026-09-10T00:00:00.000Z", bar_close_time: 1788998400000, bar_close: 23100, confirmed: true, valid: true, sensor_quality: "GOOD", freshness: "FRESH", flags: [], score: 67};
  const recovered = {...live, received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, score: 61, freshness: "STALE", provenance: "RECOVERED_HISTORY"};
  const result = await fetchAssetObservations({asset: "US100", fetchImpl: async () => response({ok: true, asset: "US100", ticker_id: "SKILLING:US100", source_profile_code: "SKILLING_US100_CFD_V1", status: "LIVE", latest_receipt: live, timeframes: {"4H": live}, current_timeframes: {"4H": live}, last_known_good_timeframes: {"4H": live}, recovered_timeframes: {"4H": recovered}})});
  assert.equal(result.status, "LIVE");
  assert.equal(result.currentTimeframes["4H"].score, 67);
  assert.equal(result.recoveredTimeframes["4H"].score, 61);
});

test("malformed recovered records fail closed", async () => {
  const malformed = {asset: "US100", symbol: "US100", ticker_id: "COINBASE:BTCUSD", timeframe: "4H", received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, bar_close: 23000, confirmed: true, valid: true, sensor_quality: "GOOD", freshness: "STALE", flags: [], score: 61, provenance: "RECOVERED_HISTORY"};
  const result = await fetchAssetObservations({asset: "US100", fetchImpl: async () => response({ok: true, asset: "US100", ticker_id: "SKILLING:US100", source_profile_code: "SKILLING_US100_CFD_V1", status: "RECOVERED", latest_receipt: null, timeframes: {}, current_timeframes: {}, last_known_good_timeframes: {}, recovered_timeframes: {"4H": malformed}})});
  assert.deepEqual(result, {available: false, reason: "IDENTITY_MISMATCH"});
});


test("receipt history requires confirmed valid same-timeframe canonical records", async () => {
  const receipt = (barCloseTime, score) => ({asset: "BTCUSD", symbol: "BTCUSD", ticker_id: "COINBASE:BTCUSD", timeframe: "4H", received_at: new Date(barCloseTime).toISOString(), bar_close_time: barCloseTime, bar_close: 78000, valid: true, confirmed: true, sensor_quality: "GOOD", freshness: "FRESH", flags: [], score});
  const result = await fetchAssetHistory({asset: "BTCUSD", timeframe: "4H", limit: 4, fetchImpl: async () => response({ok: true, asset: "BTCUSD", ticker_id: "COINBASE:BTCUSD", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", history: [receipt(1788897600000, 48), receipt(1788912000000, 54)]})});
  assert.equal(result.available, true);
  assert.deepEqual(result.history.map((item) => item.score), [48, 54]);
});

test("receipt history fails closed for missing confirmation or cross-asset records", async () => {
  const base = {asset: "BTCUSD", symbol: "BTCUSD", ticker_id: "COINBASE:BTCUSD", timeframe: "4H", received_at: "2026-09-09T00:00:00.000Z", bar_close_time: 1788912000000, bar_close: 78000, valid: true, confirmed: true, sensor_quality: "GOOD", freshness: "FRESH", flags: [], score: 54};
  for (const history of [[{...base, confirmed: false}], [{...base, asset: "XAUUSD"}]]) {
    const result = await fetchAssetHistory({asset: "BTCUSD", timeframe: "4H", fetchImpl: async () => response({ok: true, asset: "BTCUSD", ticker_id: "COINBASE:BTCUSD", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", history})});
    assert.equal(result.available, false);
  }
});

test("receipt history accepts a confirmed stale receipt for historical metrics", async () => {
  const receipt = {asset: "BTCUSD", symbol: "BTCUSD", ticker_id: "COINBASE:BTCUSD", timeframe: "4H", received_at: "2026-09-08T00:00:00.000Z", bar_close_time: 1788825600000, bar_close: 78000, valid: true, confirmed: true, sensor_quality: "GOOD", freshness: "STALE", flags: [], score: 48};
  const result = await fetchAssetHistory({asset: "BTCUSD", timeframe: "4H", fetchImpl: async () => response({ok: true, asset: "BTCUSD", ticker_id: "COINBASE:BTCUSD", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", history: [receipt]})});
  assert.equal(result.available, true);
  assert.equal(result.history[0].freshness, "STALE");
});
