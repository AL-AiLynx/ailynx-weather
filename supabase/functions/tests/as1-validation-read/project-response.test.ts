import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {createHandler} from "../../as1-validation-read/index.ts";
import {
  API_SCHEMA_VERSION,
  ProjectionError,
  computeFreshness,
  projectValidationResponse,
  resolveSelection,
  type Selection,
} from "../../as1-validation-read/project-response.ts";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const EXAMPLE_DIR = fileURLToPath(new URL(
  "../../../../satellites/AS1-tradingview/pipeline/examples/",
  import.meta.url,
));

function example(name: string): any {
  return JSON.parse(readFileSync(`${EXAMPLE_DIR}${name}`, "utf8"));
}

function rowFromEnvelope(envelope: any): any {
  return {
    id: 987,
    received_at: NOW.toISOString(),
    schema_version: envelope.schema_version,
    satellite_id: envelope.satellite_id,
    platform: envelope.platform,
    layout_id: envelope.layout_id,
    observer: envelope.observer,
    code_version: envelope.code_version,
    source_profile_code: envelope.source_profile_code,
    ticker_id: envelope.instrument.ticker_id,
    venue: envelope.instrument.venue,
    symbol: envelope.instrument.symbol,
    timeframe: envelope.timing.timeframe,
    bar_open_time: envelope.timing.bar_open_time,
    bar_close_time: envelope.timing.bar_close_time,
    packet_type: envelope.packet_type,
    confirmed: envelope.confirmed,
    sensor_quality: envelope.quality.sensor_quality,
    valid: envelope.quality.valid,
    flags: envelope.quality.flags,
    client_event_key: envelope.client_event_key,
    raw_envelope: envelope,
  };
}

function selection(view: string, timeframe = "240"): Selection {
  const result = resolveSelection(`https://example.test/?view=${view}&timeframe=${timeframe}`);
  assert.ok(result);
  return result;
}

const CASES = [
  ["MAAT", "maat-validation-envelope-v1.4.json"],
  ["MAAT2_HUB", "maat2-hub-state-envelope-v1.4.json"],
  ["MAAT2_TIME", "maat2-time-engine-envelope-v1.4.json"],
] as const;

test("1. projects all three AS1 v1.4 validation views", () => {
  for (const [view, filename] of CASES) {
    const response = projectValidationResponse(rowFromEnvelope(example(filename)), selection(view), NOW);
    assert.equal(response.ok, true);
    assert.equal(response.api_schema_version, API_SCHEMA_VERSION);
    assert.equal(response.view, view);
  }
});

test("2. Hub and Time remain separate on the same bar", () => {
  const hub = rowFromEnvelope(example("maat2-hub-state-envelope-v1.4.json"));
  const time = rowFromEnvelope(example("maat2-time-engine-envelope-v1.4.json"));
  assert.equal(hub.bar_close_time, time.bar_close_time);
  assert.notEqual(hub.client_event_key, time.client_event_key);
  assert.equal(projectValidationResponse(hub, selection("MAAT2_HUB"), NOW).source.packet_type, "HUB_STATE_SNAPSHOT");
  assert.equal(projectValidationResponse(time, selection("MAAT2_TIME"), NOW).source.packet_type, "TIME_ENGINE_SNAPSHOT");
});

test("3. rejects unknown, incomplete, or extra selectors", () => {
  assert.equal(resolveSelection("https://example.test/"), null);
  assert.equal(resolveSelection("https://example.test/?view=MAAT&timeframe=60"), null);
  assert.equal(resolveSelection("https://example.test/?view=UNKNOWN&timeframe=240"), null);
  assert.equal(resolveSelection("https://example.test/?view=toString&timeframe=240"), null);
  assert.equal(resolveSelection("https://example.test/?view=MAAT&timeframe=toString"), null);
  assert.equal(resolveSelection("https://example.test/?view=MAAT&timeframe=240&debug=1"), null);
});

test("4. removes unlisted payload fields and internal envelope data", () => {
  const row = rowFromEnvelope(example("maat-validation-envelope-v1.4.json"));
  row.raw_envelope.payload.private_note = "remove-me";
  row.raw_envelope.payload.aggregate.internal_score = 999;
  const serialized = JSON.stringify(projectValidationResponse(row, selection("MAAT"), NOW));
  assert.equal(serialized.includes("private_note"), false);
  assert.equal(serialized.includes("internal_score"), false);
  assert.equal(serialized.includes("raw_envelope"), false);
  assert.equal(serialized.includes("client_event_key"), false);
  assert.equal(serialized.includes('"id"'), false);
});

test("5. rejects a key whose packet segment does not match the row", () => {
  const row = rowFromEnvelope(example("maat2-hub-state-envelope-v1.4.json"));
  row.client_event_key = row.client_event_key.replace("HUB_STATE_SNAPSHOT", "TIME_ENGINE_SNAPSHOT");
  assert.throws(() => projectValidationResponse(row, selection("MAAT2_HUB"), NOW), ProjectionError);
});

test("6. rejects prediction and automatic result mutation", () => {
  const row = rowFromEnvelope(example("maat2-time-engine-envelope-v1.4.json"));
  row.raw_envelope.payload.prediction_direction = "UP";
  assert.throws(() => projectValidationResponse(row, selection("MAAT2_TIME"), NOW), ProjectionError);
});

test("7. preserves invalid quality instead of silently hiding it", () => {
  const row = rowFromEnvelope(example("maat2-time-engine-envelope-v1.4.json"));
  row.sensor_quality = "INVALID";
  row.valid = false;
  row.flags = ["BRIDGE_DIAG_3"];
  row.raw_envelope.quality = {sensor_quality: "INVALID", valid: false, flags: ["BRIDGE_DIAG_3"]};
  const response = projectValidationResponse(row, selection("MAAT2_TIME"), NOW);
  assert.equal(response.quality.sensor_quality, "INVALID");
  assert.equal(response.quality.valid, false);
});

test("8. computes freshness from each selected cadence", () => {
  assert.equal(computeFreshness(0, 4.5 * 60 * 60 * 1000, 14_400).state, "FRESH");
  assert.equal(computeFreshness(0, 4.5 * 60 * 60 * 1000 + 1, 14_400).state, "AGING");
  assert.equal(computeFreshness(0, 27 * 60 * 60 * 1000, 14_400).state, "EXPIRED");
});

test("9. handler requires an allowlisted selection", async () => {
  const handler = createHandler(async () => null, () => NOW);
  assert.equal((await handler(new Request("https://example.test/"))).status, 400);
  assert.equal((await handler(new Request("https://example.test/?view=MAAT&timeframe=240"))).status, 404);
  assert.equal((await handler(new Request("https://example.test/?view=MAAT&timeframe=240", {method: "POST"}))).status, 405);
});

test("10. handler returns a projected row without cache or credentials", async () => {
  const row = rowFromEnvelope(example("maat2-time-engine-envelope-v1.4.json"));
  const handler = createHandler(async (selected) => {
    assert.deepEqual(selected, selection("MAAT2_TIME"));
    return row;
  }, () => NOW);
  const response = await handler(new Request("https://example.test/?view=MAAT2_TIME&timeframe=240"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  const body = await response.json();
  assert.equal(body.view, "MAAT2_TIME");
});
