import assert from "node:assert/strict";
import test from "node:test";
import {AS1_HORUS_ENDPOINT, HORUS_TIMEFRAMES, fetchHorusSnapshot, validateHorusResponse} from "../as1-horus-client.js";

function observation(timeframe, overrides = {}) {
  return {available: true, series: "HORUS_A", symbol: "BTCUSD", ticker_id: "COINBASE:BTCUSD", timeframe, bar: {close: 79_000}, bar_close_time: 1_788_825_600_000, received_at: "2026-09-08T00:00:00.000Z", freshness: {state: "FRESH", age_seconds: 10, cadence_seconds: 3600}, quality: {sensor_quality: "GOOD", valid: true, flags: []}, state: {direction: "UP", state: null, risk: null, score: null, block: null, flow: null, next_timeframe: null, gate_state: null, gate_score: null, pressure_index: null, event: null}, ...overrides};
}
function body() {
  return {ok: true, api_schema_version: "as1-horus-read.v1", updated_at: "2026-09-08T00:00:00.000Z", instrument: {ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD"}, timeframes: Object.fromEntries(HORUS_TIMEFRAMES.map((tf) => [tf, observation(tf)]))};
}

test("accepts the complete bounded HORUS_A matrix", () => {
  const result = validateHorusResponse(body());
  assert.equal(result.applied, true);
  assert.equal(result.timeframes["1H"].bar.close, 79_000);
  assert.equal(result.timeframes["6D"].timeframe, "6D");
});

test("preserves explicit no data and invalid observations without substitution", () => {
  const value = body();
  value.timeframes["2H"] = {available: false, reason: "NO_OBSERVATION"};
  value.timeframes["3H"] = {available: false, reason: "INVALID_OBSERVATION"};
  const result = validateHorusResponse(value);
  assert.equal(result.applied, true);
  assert.deepEqual(result.timeframes["2H"], {available: false, reason: "NO_OBSERVATION"});
  assert.deepEqual(result.timeframes["3H"], {available: false, reason: "INVALID_OBSERVATION"});
});

test("uses a credential-free selector-free request", async () => {
  let captured;
  const result = await fetchHorusSnapshot({fetchImpl: async (url, init) => { captured = {url, init}; return {ok: true, status: 200, json: async () => body()}; }});
  assert.equal(result.applied, true);
  assert.equal(captured.url, AS1_HORUS_ENDPOINT);
  assert.equal(captured.init.credentials, "omit");
  assert.equal(captured.init.cache, "no-store");
});
