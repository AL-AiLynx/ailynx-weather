import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {
  AS1_VALIDATION_ENDPOINT,
  fetchValidationCards,
  fetchValidationObservation,
  validateValidationResponse,
} from "../as1-validation-client.js";

function responseBody(view = "MAAT", timeframe = "240") {
  const identity = {
    MAAT: {layout_id: "MAAT", observer: "MAAT", packet_type: "VALIDATION_SNAPSHOT"},
    MAAT2_HUB: {layout_id: "MAAT2", observer: "MAAT2_HUB", packet_type: "HUB_STATE_SNAPSHOT"},
    MAAT2_TIME: {layout_id: "MAAT2", observer: "MAAT2_TIME", packet_type: "TIME_ENGINE_SNAPSHOT"},
  }[view];
  return {
    ok: true,
    api_schema_version: "as1-validation-read.v1",
    view,
    source: {schema_version: "as1.v1.4", satellite_id: "AS1", platform: "TRADINGVIEW", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", ...identity},
    instrument: {ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD"},
    timeframe,
    bar: {open_time: 1_787_097_600_000, close_time: 1_787_112_000_000, close: 64_269.36},
    received_at: "2026-08-19T12:00:00.000Z",
    quality: {sensor_quality: "LIMITED", valid: true, flags: ["HERU_EXTERNAL_ONLY"]},
    freshness: {state: "FRESH", age_seconds: 0, cadence_seconds: 14_400},
    payload: {record_status: "WATCH"},
  };
}

test("1. accepts the three v1.4 validation views", () => {
  for (const view of ["MAAT", "MAAT2_HUB", "MAAT2_TIME"]) {
    const result = validateValidationResponse(responseBody(view), view, "240");
    assert.equal(result.available, true);
    assert.equal(result.view, view);
  }
});

test("2. preserves invalid/stale metadata for visible diagnostics", () => {
  const body = responseBody();
  body.quality = {sensor_quality: "INVALID", valid: false, flags: ["INVALID_SENSOR_RPC"]};
  body.freshness.state = "STALE";
  const result = validateValidationResponse(body, "MAAT", "240");
  assert.equal(result.available, true);
  assert.equal(result.quality.valid, false);
  assert.equal(result.freshness, "STALE");
});

test("3. rejects identity and timeframe drift", () => {
  const body = responseBody();
  body.source.packet_type = "TIME_ENGINE_SNAPSHOT";
  assert.equal(validateValidationResponse(body, "MAAT", "240").available, false);
  assert.equal(validateValidationResponse(responseBody(), "MAAT", "60").available, false);
});

test("4. fetches with credential-free no-store selection", async () => {
  let captured;
  const result = await fetchValidationObservation({
    view: "MAAT2_TIME",
    timeframe: "480",
    fetchImpl: async (url, init) => {
      captured = {url, init};
      return {ok: true, status: 200, json: async () => responseBody("MAAT2_TIME", "480")};
    },
  });
  assert.equal(result.available, true);
  const url = new URL(captured.url);
  assert.equal(`${url.origin}${url.pathname}`, AS1_VALIDATION_ENDPOINT);
  assert.equal(url.searchParams.get("view"), "MAAT2_TIME");
  assert.equal(url.searchParams.get("timeframe"), "480");
  assert.equal(captured.init.credentials, "omit");
  assert.equal(captured.init.cache, "no-store");
});

test("5. combines Hub and Time only when their bar closes match", async () => {
  const result = await fetchValidationCards({
    timeframe: "240",
    fetchImpl: async (url) => {
      const view = new URL(url).searchParams.get("view");
      return {ok: true, status: 200, json: async () => responseBody(view)};
    },
  });
  assert.equal(result.maat.available, true);
  assert.equal(result.maat2.hub.available, true);
  assert.equal(result.maat2.time.available, true);
  assert.equal(result.maat2.synchronized, true);
});

test("6. normalizes no observation, malformed JSON, and network errors", async () => {
  const missing = await fetchValidationObservation({view: "MAAT", fetchImpl: async () => ({ok: false, status: 404})});
  assert.equal(missing.reason, "NO_OBSERVATION");
  const malformed = await fetchValidationObservation({view: "MAAT", fetchImpl: async () => ({ok: true, status: 200, json: async () => { throw new Error("bad"); }})});
  assert.equal(malformed.reason, "MALFORMED_JSON");
  const network = await fetchValidationObservation({view: "MAAT", fetchImpl: async () => { throw new Error("offline"); }});
  assert.equal(network.reason, "NETWORK_ERROR");
});

test("7. successful result exposes no raw envelope or event key", () => {
  const result = validateValidationResponse(responseBody(), "MAAT", "240");
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("raw_envelope"), false);
  assert.equal(serialized.includes("client_event_key"), false);
});

test("8. accepts canonical TradingView daily timeframe D", () => {
  const result = validateValidationResponse(responseBody("MAAT", "D"), "MAAT", "D");
  assert.equal(result.available, true);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<option value="D">1D<\/option>/);
});

test("9. rejects inherited-property view names", async () => {
  const result = await fetchValidationObservation({view: "toString"});
  assert.deepEqual(result, {available: false, reason: "INVALID_REQUEST"});
});
