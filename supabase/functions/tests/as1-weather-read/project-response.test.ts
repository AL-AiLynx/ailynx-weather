import assert from "node:assert/strict";
import test from "node:test";

import { createHandler } from "../../as1-weather-read/index.ts";
import {
  API_SCHEMA_VERSION,
  ProjectionError,
  computeFreshness,
  projectWeatherResponse,
} from "../../as1-weather-read/project-response.ts";

const NOW = new Date("2026-08-19T12:00:00.000Z");

function liveRow(): any {
  return {
    id: 987,
    client_event_key: "must-never-be-public",
    received_at: NOW.toISOString(),
    schema_version: "as1.v1.3",
    satellite_id: "AS1",
    platform: "TRADINGVIEW",
    layout_id: "HORUS_A",
    observer: "HORUS",
    code_version: "HETEM_GATE_V1_AS1_V1_3",
    source_profile_code: "CB_BTCUSD_SPOT_20260722_V1",
    ticker_id: "COINBASE:BTCUSD",
    venue: "COINBASE",
    symbol: "BTCUSD",
    timeframe: "240",
    bar_open_time: 1_787_097_600_000,
    bar_close_time: 1_787_112_000_000,
    packet_type: "BAR_CLOSE_SNAPSHOT",
    confirmed: true,
    sensor_quality: "GOOD",
    valid: true,
    flags: [],
    raw_envelope: {
      schema_version: "as1.v1.3",
      satellite_id: "AS1",
      platform: "TRADINGVIEW",
      layout_id: "HORUS_A",
      observer: "HORUS",
      code_version: "HETEM_GATE_V1_AS1_V1_3",
      source_profile_code: "CB_BTCUSD_SPOT_20260722_V1",
      instrument: {
        ticker_id: "COINBASE:BTCUSD",
        venue: "COINBASE",
        symbol: "BTCUSD",
      },
      timing: {
        timeframe: "240",
        bar_open_time: 1_787_097_600_000,
        bar_close_time: 1_787_112_000_000,
      },
      bar: { close: 64_269.36 },
      packet_type: "BAR_CLOSE_SNAPSHOT",
      confirmed: true,
      quality: { sensor_quality: "GOOD", valid: true, flags: [] },
      payload: {
        context: {
          system: "AiLynx",
          engine: "GENUT",
          season: "AL HETEM",
          season_code: "HETEM",
          group: "A",
          layer: "FORCE",
          private_context: "remove-me",
        },
        horus: {
          dir: "UP",
          state: "WEAK",
          risk: "WATCH",
          total: 53,
          block: "CLEAR",
          flow: "UP",
          next_tf: "1D",
          mode_code: 2,
          internal_score: 999,
        },
        hetem: {
          gate_state: "OPEN",
          gate_score: 61,
          pressure_index: 42,
          pressure_band: "MID",
          secret_gate_note: "remove-me",
        },
        gaw: {
          gv: "GAW_V3",
          ec: "TFS",
          es: 1,
          gp: "OBSERVE",
          gaw_code: "public-code",
          gaw_line: "public-line",
          internal_policy: "remove-me",
        },
        event: {
          primary_name: "TF_SNAPSHOT",
          trigger: "BAR_CLOSE",
          bar_status: "CLOSED",
          primary_code: 10,
          event_signature: "remove-me",
        },
        forbidden_payload_root: "remove-me",
      },
      AS1_INGEST_TOKEN: "never-public",
    },
  };
}

function rowReceivedAt(ageMs: number) {
  const row = liveRow();
  row.received_at = new Date(NOW.getTime() - ageMs).toISOString();
  return row;
}

function expectProjectionError(mutator: (row: ReturnType<typeof liveRow>) => void) {
  const row = liveRow();
  mutator(row);
  assert.throws(() => projectWeatherResponse(row, NOW), ProjectionError);
}

test("1. projects a valid live HORUS_A 4H observation", () => {
  const response = projectWeatherResponse(liveRow(), NOW);
  assert.equal(response.ok, true);
  assert.equal(response.api_schema_version, API_SCHEMA_VERSION);
  assert.equal(response.timeframe, "240");
  assert.equal(response.bar.close, 64_269.36);
  assert.equal(response.freshness.state, "FRESH");
});

test("2. removes payload fields outside the explicit allowlist", () => {
  const serialized = JSON.stringify(projectWeatherResponse(liveRow(), NOW));
  assert.equal(serialized.includes("private_context"), false);
  assert.equal(serialized.includes("internal_score"), false);
  assert.equal(serialized.includes("secret_gate_note"), false);
  assert.equal(serialized.includes("internal_policy"), false);
  assert.equal(serialized.includes("event_signature"), false);
  assert.equal(serialized.includes("forbidden_payload_root"), false);
});

test("3. never exposes raw_envelope", () => {
  assert.equal(JSON.stringify(projectWeatherResponse(liveRow(), NOW)).includes("raw_envelope"), false);
});

test("4. never exposes id or client_event_key", () => {
  const serialized = JSON.stringify(projectWeatherResponse(liveRow(), NOW));
  assert.equal(serialized.includes("client_event_key"), false);
  assert.equal(Object.hasOwn(projectWeatherResponse(liveRow(), NOW), "id"), false);
});

test("5. rejects a wrong fixed identity", () => {
  expectProjectionError((row) => {
    row.layout_id = "HORUS_B";
  });
  expectProjectionError((row) => {
    row.raw_envelope.layout_id = "HORUS_B";
  });
});

test("6. rejects a timeframe other than 240", () => {
  expectProjectionError((row) => {
    row.timeframe = "60";
  });
});

test("7. rejects invalid, unconfirmed, and non-GOOD observations", () => {
  for (const mutate of [
    (row: ReturnType<typeof liveRow>) => { row.valid = false; },
    (row: ReturnType<typeof liveRow>) => { row.confirmed = false; },
    (row: ReturnType<typeof liveRow>) => { row.sensor_quality = "WATCH"; },
  ]) {
    expectProjectionError(mutate);
  }
});

test("8. rejects a non-finite or non-number close", () => {
  expectProjectionError((row) => {
    row.raw_envelope.bar.close = "64269.36";
  });
});

test("9. rejects unsafe or reversed bar times", () => {
  expectProjectionError((row) => {
    row.bar_open_time = row.bar_close_time;
    row.raw_envelope.timing.bar_open_time = row.bar_close_time;
  });
});

test("10. FRESH includes the exact 4h30m boundary", () => {
  assert.equal(projectWeatherResponse(rowReceivedAt(4.5 * 60 * 60 * 1000), NOW).freshness.state, "FRESH");
});

test("11. AGING spans just over 4h30m through 8h30m", () => {
  assert.equal(projectWeatherResponse(rowReceivedAt(4.5 * 60 * 60 * 1000 + 1), NOW).freshness.state, "AGING");
  assert.equal(projectWeatherResponse(rowReceivedAt(8.5 * 60 * 60 * 1000), NOW).freshness.state, "AGING");
});

test("12. STALE spans just over 8h30m through 24h", () => {
  assert.equal(projectWeatherResponse(rowReceivedAt(8.5 * 60 * 60 * 1000 + 1), NOW).freshness.state, "STALE");
  assert.equal(projectWeatherResponse(rowReceivedAt(24 * 60 * 60 * 1000), NOW).freshness.state, "STALE");
});

test("13. EXPIRED starts after 24h", () => {
  assert.equal(projectWeatherResponse(rowReceivedAt(24 * 60 * 60 * 1000 + 1), NOW).freshness.state, "EXPIRED");
});

test("14. a timestamp at least five minutes in the future is INVALID_CLOCK", () => {
  const freshness = computeFreshness(NOW.getTime() + 5 * 60 * 1000, NOW.getTime());
  assert.equal(freshness.state, "INVALID_CLOCK");
  assert.equal(freshness.age_seconds, 0);
});

test("15. handler allows GET and ignores query parameters", async () => {
  const handler = createHandler(async () => liveRow(), () => NOW);
  const response = await handler(new Request("https://example.test/as1-weather-read?timeframe=1&layout=MAAT"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).timeframe, "240");
});

test("16. handler allows OPTIONS and rejects POST with 405", async () => {
  const handler = createHandler(async () => liveRow(), () => NOW);
  const options = await handler(new Request("https://example.test/as1-weather-read", { method: "OPTIONS" }));
  const post = await handler(new Request("https://example.test/as1-weather-read", { method: "POST" }));
  assert.equal(options.status, 204);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, OPTIONS");
  for (const response of [options, post]) {
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
    assert.equal(response.headers.get("access-control-allow-headers"), "content-type");
  }
});

test("17. every tested response disables caching", async () => {
  const successHandler = createHandler(async () => liveRow(), () => NOW);
  const emptyHandler = createHandler(async () => null, () => NOW);
  const responses = [
    await successHandler(new Request("https://example.test/as1-weather-read")),
    await successHandler(new Request("https://example.test/as1-weather-read", { method: "OPTIONS" })),
    await successHandler(new Request("https://example.test/as1-weather-read", { method: "POST" })),
    await emptyHandler(new Request("https://example.test/as1-weather-read")),
  ];
  for (const response of responses) {
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(response.headers.get("pragma"), "no-cache");
  }
});

test("18. internal database errors are not exposed", async () => {
  const secret = "postgres://admin:password@example.test/private";
  const handler = createHandler(async () => {
    throw new Error(secret);
  }, () => NOW);
  const response = await handler(new Request("https://example.test/as1-weather-read"));
  const body = await response.text();
  assert.equal(response.status, 503);
  assert.equal(body.includes(secret), false);
  assert.deepEqual(JSON.parse(body), {
    ok: false,
    api_schema_version: API_SCHEMA_VERSION,
    error: "SERVICE_UNAVAILABLE",
  });
});

test("19. rejects null or structured values in allowlisted payload fields", () => {
  expectProjectionError((row) => {
    row.raw_envelope.payload.horus.state = null;
  });
  expectProjectionError((row) => {
    row.raw_envelope.payload.hetem.gate_score = { internal: true };
  });
});

test("20. rejects an invalid received_at timestamp", () => {
  expectProjectionError((row) => {
    row.received_at = "not-an-iso-timestamp";
  });
});
