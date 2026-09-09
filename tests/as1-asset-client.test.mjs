import assert from "node:assert/strict";
import test from "node:test";
import {fetchAssetObservations} from "../as1-asset-client.js";
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
