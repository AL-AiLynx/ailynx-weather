import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {ValidationError, validateEnvelope} from "../../as1-ingest/validate-envelope.ts";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../../satellites/AS1-tradingview/pipeline/examples/", import.meta.url));
function example(name: string): any { return JSON.parse(readFileSync(`${EXAMPLE_DIR}${name}`, "utf8")); }
const V13_FIXTURE = fileURLToPath(new URL("../../../../satellites/AS1-tradingview/pipeline/tests/fixtures/v1.3/AS1_V13_NORMAL_001.json", import.meta.url));

const V14_CASES = [
  ["maat-validation-envelope-v1.4.json", "VALIDATION_SNAPSHOT"],
  ["maat2-hub-state-envelope-v1.4.json", "HUB_STATE_SNAPSHOT"],
  ["maat2-time-engine-envelope-v1.4.json", "TIME_ENGINE_SNAPSHOT"],
] as const;

test("1. accepts all three AS1 v1.4 packet identities", () => {
  for (const [filename, packetType] of V14_CASES) {
    const row = validateEnvelope(example(filename));
    assert.equal(row.schema_version, "as1.v1.4");
    assert.equal(row.packet_type, packetType);
  }
});

test("2. preserves AS1 v1.3 acceptance and legacy key", () => {
  const event = JSON.parse(readFileSync(V13_FIXTURE, "utf8")).raw_events[0];
  const row = validateEnvelope(event);
  assert.equal(row.schema_version, "as1.v1.3");
  assert.equal(row.packet_type, "BAR_CLOSE_SNAPSHOT");
});

test("3. packet_type keeps same-bar Hub and Time keys distinct", () => {
  const hub = validateEnvelope(example("maat2-hub-state-envelope-v1.4.json"));
  const time = validateEnvelope(example("maat2-time-engine-envelope-v1.4.json"));
  assert.equal(hub.bar_close_time, time.bar_close_time);
  assert.notEqual(hub.client_event_key, time.client_event_key);
});

test("4. rejects a mismatched v1.4 matrix or client key", () => {
  const hub = example("maat2-hub-state-envelope-v1.4.json");
  hub.observer = "MAAT2_TIME";
  assert.throws(() => validateEnvelope(hub), ValidationError);
  const maat = example("maat-validation-envelope-v1.4.json");
  maat.client_event_key = maat.client_event_key.replace("VALIDATION_SNAPSHOT", "TIME_ENGINE_SNAPSHOT");
  assert.throws(() => validateEnvelope(maat), ValidationError);
});

test("5. rejects prediction and automatic HIT/MISS mutations", () => {
  const maat = example("maat-validation-envelope-v1.4.json");
  maat.payload.automatic_hit_miss = "HIT";
  assert.throws(() => validateEnvelope(maat), ValidationError);
  const time = example("maat2-time-engine-envelope-v1.4.json");
  time.payload.prediction_direction = "UP";
  assert.throws(() => validateEnvelope(time), ValidationError);
  const hub = example("maat2-hub-state-envelope-v1.4.json");
  hub.payload.hit_miss = "MISS";
  assert.throws(() => validateEnvelope(hub), ValidationError);
});

test("6. rejects unknown top-level or payload fields in v1.4", () => {
  const event = example("maat-validation-envelope-v1.4.json");
  event.webhook_token = "must-never-be-in-body";
  assert.throws(() => validateEnvelope(event), ValidationError);
  delete event.webhook_token;
  event.payload.prediction = "UP";
  assert.throws(() => validateEnvelope(event), ValidationError);
});

test("7. rejects schema-invalid nested values before they reach the read projection", () => {
  const maat = example("maat-validation-envelope-v1.4.json");
  maat.payload.stopwatch.target_time = null;
  assert.throws(() => validateEnvelope(maat), ValidationError);

  const hub = example("maat2-hub-state-envelope-v1.4.json");
  hub.payload.guards.mask = 16;
  assert.throws(() => validateEnvelope(hub), ValidationError);

  const time = example("maat2-time-engine-envelope-v1.4.json");
  time.payload.time.window_flag = "false";
  assert.throws(() => validateEnvelope(time), ValidationError);
});

test("8. rejects the observed Time score overflow and accepts its invalid-bridge neutral projection", () => {
  for (const [score, value] of [["window", 122], ["risk", 112]] as const) {
    const overflow = example("maat2-time-engine-envelope-v1.4.json");
    overflow.payload.scores[score] = value;
    assert.throws(() => validateEnvelope(overflow), new RegExp(`${score} is above maximum`));
  }

  const projected = example("maat2-time-engine-envelope-v1.4.json");
  projected.quality = {
    sensor_quality: "INVALID",
    valid: false,
    flags: ["HERU_EXTERNAL_ONLY", "BRIDGE_INVALID", "BRIDGE_STATE_PACKET_INVALID", "BRIDGE_METRICS_PACKET_INVALID", "BRIDGE_DIAG_3"],
  };
  projected.payload.record_status = "WATCH";
  projected.payload.scores = {structure: 0, force: 0, window: 0, risk: 0};
  projected.payload.hub = {phase_code: 0, result_code: 0, core_state_code: 3, peripheral_state_code: 3};
  Object.assign(projected.payload.time, {
    score: 0,
    state_code: 0,
    role_code: 9,
    result_code: 0,
    why_code: 82,
    noise_score: 0,
    window_flag: false,
    reset_flag: false,
    valid: false,
    guard_mask: 0,
    alert_mask: 0,
    diag_code: 3,
  });

  const row = validateEnvelope(projected);
  assert.equal(row.valid, false);
  assert.equal(row.packet_type, "TIME_ENGINE_SNAPSHOT");
});
