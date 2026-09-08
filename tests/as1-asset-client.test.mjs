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
  const result = await fetchAssetObservations({asset: "DXY", fetchImpl: async () => response({ok: true, asset: "DXY", ticker_id: "CAPITALCOM:DXY", source_profile_code: "CAPITALCOM_DXY_CFD_V1", status: "PLANNED", timeframes: {}})});
  assert.equal(result.available, true); assert.equal(result.status, "PLANNED");
});
test("multi-asset reader fails closed for unsupported assets", async () => {
  assert.deepEqual(await fetchAssetObservations({asset: "EURUSD"}), {available: false, reason: "UNSUPPORTED_ASSET"});
});
test("single registry fixes the four canonical asset identities", () => {
  assert.deepEqual(Object.keys(ASSET_READERS), ["BTCUSD", "XAUUSD", "DXY", "US100"]);
  assert.equal(ASSET_READERS.US100.tickerId, "SKILLING:US100");
});
