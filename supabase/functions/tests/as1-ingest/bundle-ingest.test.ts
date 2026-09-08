import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {persistRows} from "../../as1-ingest/persist-rows.ts";
import {ValidationError, validateIngestRequest} from "../../as1-ingest/validate-envelope.ts";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
function fixture(name: string): any { return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}`, "utf8")); }

test("bundle fixtures split into the expected timeframe rows", () => {
  const cases = [
    ["genut-b-bundle-4h.json", ["4H"]],
    ["genut-b-bundle-4h-8h.json", ["4H", "8H"]],
    ["genut-b-bundle-4h-12h.json", ["4H", "12H"]],
    ["genut-b-bundle-all.json", ["4H", "8H", "12H", "1D"]],
  ] as const;

  for (const [filename, timeframes] of cases) {
    const request = validateIngestRequest(fixture(filename));
    assert.equal(request.kind, "bundle");
    assert.deepEqual(request.rows.map((row) => row.timeframe), timeframes);
    assert.equal(request.rows.length, timeframes.length);
    assert.equal(request.total_frames, timeframes.length);
    assert.equal(request.duplicate_frames, 0);
  }
});

test("bundle frame maps to the existing LIVE row and preserves bundle payload", () => {
  const bundle = fixture("genut-b-bundle-4h.json");
  const request = validateIngestRequest(bundle);
  const row = request.rows[0];

  assert.equal(row.schema_version, "as1.bundle.v0.1");
  assert.equal(row.satellite_id, "AS1");
  assert.equal(row.platform, "TRADINGVIEW");
  assert.equal(row.layout_id, "HORUS_B");
  assert.equal(row.observer, "GENUT_B");
  assert.equal(row.code_version, "NOT_PROVIDED_BY_BUNDLE_V0_1");
  assert.equal(row.source_profile_code, "CB_BTCUSD_SPOT_20260722_V1");
  assert.equal(row.packet_type, "MTF_BAR_CLOSE_BATCH");
  assert.equal(row.timeframe, "4H");
  assert.equal(row.bar_open_time, bundle.frames[0].bar_open_at);
  assert.equal(row.bar_close_time, bundle.frames[0].bar_close_at);
  assert.equal(row.sent_at, bundle.frames[0].observed_at);
  assert.equal(row.client_event_key, bundle.frames[0].frame_event_key);
  assert.equal(row.confirmed, true);
  assert.equal(row.sensor_quality, "GOOD");

  const payload = row.raw_envelope.payload as Record<string, any>;
  assert.equal(payload.batch_event_key, bundle.batch_event_key);
  assert.equal(payload.frame_event_key, bundle.frames[0].frame_event_key);
  assert.deepEqual(payload.state, bundle.frames[0].state);
  assert.deepEqual(payload.values, bundle.frames[0].values);
  assert.deepEqual(payload.frame_quality, bundle.frames[0].quality);
  assert.deepEqual(payload.bundle_quality, bundle.quality);
  assert.equal((payload.bundle_metadata as Record<string, any>).frames, undefined);
  assert.equal((payload.bundle_metadata as Record<string, any>).emitted_at, bundle.emitted_at);
});

test("duplicate frame_event_key is collapsed before persistence", () => {
  const request = validateIngestRequest(fixture("genut-b-bundle-duplicate.json"));
  assert.equal(request.total_frames, 2);
  assert.equal(request.rows.length, 1);
  assert.equal(request.duplicate_frames, 1);
});

test("database 23505 keeps frame_event_key idempotent across requests", async () => {
  const rows = validateIngestRequest(fixture("genut-b-bundle-4h-8h.json")).rows;
  const stored = new Set<string>();
  const insert = async (row: (typeof rows)[number]) => {
    if (stored.has(row.client_event_key)) return {error: {code: "23505", message: "duplicate key"}};
    stored.add(row.client_event_key);
    return {error: null};
  };

  const first = await persistRows(rows, insert);
  const second = await persistRows(rows, insert);
  assert.deepEqual({accepted: first.accepted_frames, duplicate: first.duplicate_frames}, {accepted: 2, duplicate: 0});
  assert.deepEqual({accepted: second.accepted_frames, duplicate: second.duplicate_frames}, {accepted: 0, duplicate: 2});
  assert.equal(stored.size, 2);
});

test("persistence continues after a frame-level database failure", async () => {
  const rows = validateIngestRequest(fixture("genut-b-bundle-4h-8h.json")).rows;
  const summary = await persistRows(rows, async (row) => row.timeframe === "4H"
    ? {error: {code: "DB_TEST_FAILURE", message: "test failure"}}
    : {error: null});

  assert.equal(summary.accepted_frames, 1);
  assert.equal(summary.duplicate_frames, 0);
  assert.equal(summary.rejected_frames, 1);
  assert.equal(summary.failures[0].client_event_key, rows[0].client_event_key);
});

test("unsupported bundle schema is rejected", () => {
  assert.throws(
    () => validateIngestRequest(fixture("genut-b-bundle-unsupported.json")),
    new ValidationError("unsupported schema_version"),
  );
});

test("malformed frame is rejected", () => {
  assert.throws(
    () => validateIngestRequest(fixture("genut-b-bundle-malformed.json")),
    new ValidationError("state must be an object"),
  );
});

test("numeric bundle quality maps to ledger categories without losing raw values", () => {
  const bundle = fixture("genut-b-bundle-4h.json");
  bundle.frames[0].quality = {sensor_quality: 62.5, valid: true, flags: ["PARTIAL_FRAME"]};
  const row = validateIngestRequest(bundle).rows[0];
  assert.equal(row.sensor_quality, "LIMITED");
  assert.deepEqual((row.raw_envelope.payload as Record<string, any>).frame_quality, bundle.frames[0].quality);

  bundle.frames[0].quality.valid = false;
  assert.equal(validateIngestRequest(bundle).rows[0].sensor_quality, "INVALID");
});
