import assert from "node:assert/strict";
import test from "node:test";

import {fetchAs1Observation} from "../as1-observation-client.js";

function responseBody(view = "MAAT", timeframe = "240") {
  const identity = {
    MAAT: {layout_id: "MAAT", observer: "MAAT", code_version: "MAAT_STOPWATCH_AS1_V1_4", packet_type: "VALIDATION_SNAPSHOT"},
    MAAT2_HUB: {layout_id: "MAAT2", observer: "MAAT2_HUB", code_version: "MAAT2_HUB_V1_1_AS1_V1_4", packet_type: "HUB_STATE_SNAPSHOT"},
    MAAT2_TIME: {layout_id: "MAAT2", observer: "MAAT2_TIME", code_version: "MAAT2_TIME_V1_AS1_V1_4", packet_type: "TIME_ENGINE_SNAPSHOT"},
  }[view];
  return {
    ok: true, api_schema_version: "as1-validation-read.v1", view,
    source: {schema_version: "as1.v1.4", satellite_id: "AS1", platform: "TRADINGVIEW", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", ...identity},
    instrument: {ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD"},
    timeframe, bar: {open_time: 1_787_097_600_000, close_time: 1_787_112_000_000, close: 64_269.36},
    received_at: "2026-09-08T00:00:00.000Z", quality: {sensor_quality: "GOOD", valid: true, flags: []},
    freshness: {state: "FRESH", age_seconds: 30, cadence_seconds: 14_400},
    payload: {record_status: "WATCH"},
  };
}

test("reads the MAAT public observation with no credential", async () => {
  let captured;
  const result = await fetchAs1Observation({
    observer: "MAAT", packetType: "VALIDATION_SNAPSHOT",
    fetchImpl: async (url, init) => {
      captured = {url, init};
      return {ok: true, status: 200, json: async () => responseBody()};
    },
  });
  assert.equal(result.available, true);
  assert.equal(result.bar.close, 64_269.36);
  assert.equal(new URL(captured.url).searchParams.get("view"), "MAAT");
  assert.equal(captured.init.credentials, "omit");
  assert.equal(Object.hasOwn(captured.init, "headers"), false);
});

test("fails closed for unsupported asset, observer, packet, or timeframe", async () => {
  for (const selection of [
    {asset: "NASDAQ:NDX", observer: "MAAT", packetType: "VALIDATION_SNAPSHOT", timeframe: "240"},
    {observer: "GENUT_A", packetType: "BAR_CLOSE_SNAPSHOT", timeframe: "240"},
    {observer: "MAAT", packetType: "VALIDATION_SNAPSHOT", timeframe: "60"},
  ]) {
    assert.deepEqual(await fetchAs1Observation(selection), {available: false, reason: "UNSUPPORTED_SELECTION"});
  }
});
