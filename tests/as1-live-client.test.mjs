import assert from "node:assert/strict";
import test from "node:test";

import {
  AS1_LIVE_ENDPOINT,
  fetchAs1LiveObservation,
  validateAs1LiveResponse,
} from "../as1-live-client.js";

function liveResponse(freshness = "FRESH") {
  return {
    ok: true,
    api_schema_version: "as1-weather-read.v1",
    generated_at: "2026-08-23T12:00:00.000Z",
    source: {
      schema_version: "as1.v1.3",
      satellite_id: "AS1",
      platform: "TRADINGVIEW",
      layout_id: "HORUS_A",
      observer: "HORUS",
      code_version: "HETEM_GATE_V1_AS1_V1_3",
      source_profile_code: "CB_BTCUSD_SPOT_20260722_V1",
    },
    instrument: {
      ticker_id: "COINBASE:BTCUSD",
      venue: "COINBASE",
      symbol: "BTCUSD",
    },
    timeframe: "240",
    bar: {
      open_time: 1_787_097_600_000,
      close_time: 1_787_112_000_000,
      close: 64_269.36,
    },
    received_at: "2026-08-23T11:59:30.000Z",
    quality: {
      sensor_quality: "GOOD",
      valid: true,
      flags: [],
    },
    payload: {
      horus: { state: "WEAK" },
    },
    freshness: {
      state: freshness,
      age_seconds: 30,
      cadence_seconds: 14_400,
    },
  };
}

function cloneResponse(freshness = "FRESH") {
  return structuredClone(liveResponse(freshness));
}

function jsonFetch(body, status = 200) {
  return async () => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("1. accepts a valid FRESH response", () => {
  const result = validateAs1LiveResponse(liveResponse("FRESH"));
  assert.equal(result.applied, true);
  assert.equal(result.freshness, "FRESH");
  assert.equal(result.price, 64_269.36);
});

test("2. accepts a valid AGING response", () => {
  const result = validateAs1LiveResponse(liveResponse("AGING"));
  assert.equal(result.applied, true);
  assert.equal(result.freshness, "AGING");
});

test("3. returns fallback for STALE", () => {
  assert.deepEqual(validateAs1LiveResponse(liveResponse("STALE")), {
    applied: false,
    reason: "STALE",
  });
});

test("4. returns fallback for EXPIRED", () => {
  assert.deepEqual(validateAs1LiveResponse(liveResponse("EXPIRED")), {
    applied: false,
    reason: "EXPIRED",
  });
});

test("5. returns fallback for INVALID_CLOCK", () => {
  assert.deepEqual(validateAs1LiveResponse(liveResponse("INVALID_CLOCK")), {
    applied: false,
    reason: "INVALID_CLOCK",
  });
});

test("6. rejects an API version mismatch", () => {
  const input = cloneResponse();
  input.api_schema_version = "as1-weather-read.v2";
  assert.equal(validateAs1LiveResponse(input).reason, "API_SCHEMA_MISMATCH");
});

test("7. rejects a source identity mismatch", () => {
  const input = cloneResponse();
  input.source.layout_id = "HORUS_B";
  assert.equal(validateAs1LiveResponse(input).reason, "IDENTITY_MISMATCH");
});

test("8. rejects a ticker mismatch", () => {
  const input = cloneResponse();
  input.instrument.ticker_id = "OTHER:BTCUSD";
  assert.equal(validateAs1LiveResponse(input).reason, "INSTRUMENT_MISMATCH");
});

test("9. rejects a timeframe mismatch", () => {
  const input = cloneResponse();
  input.timeframe = "60";
  assert.equal(validateAs1LiveResponse(input).reason, "TIMEFRAME_MISMATCH");
});

test("10. rejects a quality mismatch", () => {
  for (const mutate of [
    (input) => { input.quality.sensor_quality = "WATCH"; },
    (input) => { input.quality.valid = false; },
    (input) => { input.quality.flags = null; },
  ]) {
    const input = cloneResponse();
    mutate(input);
    assert.equal(validateAs1LiveResponse(input).reason, "QUALITY_MISMATCH");
  }
});

test("11. rejects an invalid close", () => {
  for (const close of [0, -1, Number.POSITIVE_INFINITY, "64269.36"]) {
    const input = cloneResponse();
    input.bar.close = close;
    assert.equal(validateAs1LiveResponse(input).reason, "INVALID_CLOSE");
  }
});

test("12. rejects an invalid received_at", () => {
  const input = cloneResponse();
  input.received_at = "not-a-timestamp";
  assert.equal(validateAs1LiveResponse(input).reason, "INVALID_RECEIVED_AT");
});

test("13. normalizes malformed JSON", async () => {
  const result = await fetchAs1LiveObservation({
    fetchImpl: async () => new Response("{", { status: 200 }),
  });
  assert.deepEqual(result, { applied: false, reason: "MALFORMED_JSON" });
});

test("14. normalizes an HTTP 4xx response", async () => {
  const result = await fetchAs1LiveObservation({
    fetchImpl: jsonFetch({ ok: false }, 404),
  });
  assert.deepEqual(result, { applied: false, reason: "HTTP_4XX" });
});

test("15. normalizes an HTTP 5xx response", async () => {
  const result = await fetchAs1LiveObservation({
    fetchImpl: jsonFetch({ ok: false }, 503),
  });
  assert.deepEqual(result, { applied: false, reason: "HTTP_5XX" });
});

test("16. normalizes timeout and AbortError", async () => {
  const fetchImpl = async (_url, { signal }) =>
    await new Promise((_resolve, reject) => {
      const abortError = Object.assign(new Error("aborted"), {
        name: "AbortError",
      });
      signal.addEventListener("abort", () => reject(abortError), {
        once: true,
      });
    });
  const result = await fetchAs1LiveObservation({ fetchImpl, timeoutMs: 5 });
  assert.deepEqual(result, { applied: false, reason: "TIMEOUT" });
});

test("17. does not pass unexpected payload keys to the result", () => {
  const input = cloneResponse();
  input.payload.unexpected_private_field = "do-not-return";
  const result = validateAs1LiveResponse(input);
  assert.equal(JSON.stringify(result).includes("unexpected_private_field"), false);
  assert.equal(JSON.stringify(result).includes("do-not-return"), false);
});

test("18. does not expose raw_envelope", () => {
  const input = cloneResponse();
  input.raw_envelope = { private: "do-not-return" };
  const result = validateAs1LiveResponse(input);
  assert.equal(JSON.stringify(result).includes("raw_envelope"), false);
  assert.equal(JSON.stringify(result).includes("do-not-return"), false);
});

test("19. does not expose id or client_event_key", () => {
  const input = cloneResponse();
  input.id = 123;
  input.client_event_key = "do-not-return";
  const result = validateAs1LiveResponse(input);
  assert.equal(Object.hasOwn(result, "id"), false);
  assert.equal(Object.hasOwn(result, "client_event_key"), false);
  assert.equal(JSON.stringify(result).includes("do-not-return"), false);
});

test("20. success returns only the minimal PWA fields", () => {
  const result = validateAs1LiveResponse(liveResponse());
  assert.deepEqual(Object.keys(result).sort(), [
    "applied",
    "barCloseTime",
    "freshness",
    "price",
    "receivedAt",
    "timeframe",
  ]);
});

test("21. sends one credential-free no-store GET to the fixed endpoint", async () => {
  let capturedUrl;
  let capturedOptions;
  const result = await fetchAs1LiveObservation({
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return new Response(JSON.stringify(liveResponse()), { status: 200 });
    },
  });

  assert.equal(result.applied, true);
  assert.equal(capturedUrl, AS1_LIVE_ENDPOINT);
  assert.equal(new URL(capturedUrl).search, "");
  assert.equal(capturedOptions.method, "GET");
  assert.equal(capturedOptions.cache, "no-store");
  assert.equal(capturedOptions.credentials, "omit");
  assert.equal(capturedOptions.redirect, "error");
  assert.equal(Object.hasOwn(capturedOptions, "body"), false);
  assert.equal(Object.hasOwn(capturedOptions, "headers"), false);
});

test("22. rejects missing, reversed, or invalid bar times", () => {
  for (const mutate of [
    (input) => { delete input.bar.open_time; },
    (input) => { input.bar.open_time = input.bar.close_time; },
    (input) => { input.bar.close_time = "not-a-timestamp"; },
  ]) {
    const input = cloneResponse();
    mutate(input);
    assert.equal(validateAs1LiveResponse(input).reason, "INVALID_BAR_TIME");
  }
});

test("23. normalizes an empty response body", () => {
  assert.deepEqual(validateAs1LiveResponse(null), {
    applied: false,
    reason: "EMPTY_RESPONSE",
  });
});

test("24. normalizes a network error", async () => {
  const result = await fetchAs1LiveObservation({
    fetchImpl: async () => {
      throw new TypeError("network unavailable");
    },
  });
  assert.deepEqual(result, { applied: false, reason: "NETWORK_ERROR" });
});

test("25. rejects unknown or malformed freshness metadata", () => {
  for (const mutate of [
    (input) => { input.freshness.state = "UNKNOWN"; },
    (input) => { input.freshness.age_seconds = -1; },
    (input) => { input.freshness.cadence_seconds = 3600; },
  ]) {
    const input = cloneResponse();
    mutate(input);
    assert.equal(validateAs1LiveResponse(input).reason, "FRESHNESS_MISMATCH");
  }
});

test("26. rejects an API body that is not marked ok", () => {
  const input = cloneResponse();
  input.ok = false;
  assert.equal(validateAs1LiveResponse(input).reason, "API_NOT_OK");
});
