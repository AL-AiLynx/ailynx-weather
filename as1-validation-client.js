export const AS1_VALIDATION_ENDPOINT =
  "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-validation-read";
export const AS1_VALIDATION_TIMEOUT_MS = 5000;

const API_SCHEMA_VERSION = "as1-validation-read.v1";
const SOURCE_PROFILE = "CB_BTCUSD_SPOT_20260722_V1";
const TICKER_ID = "COINBASE:BTCUSD";
const TIMEFRAMES = new Set(["240", "480", "720", "D", "1D", "1440"]);
const VIEW_IDENTITY = Object.freeze({
  MAAT: {layout_id: "MAAT", observer: "MAAT", packet_type: "VALIDATION_SNAPSHOT"},
  MAAT2_HUB: {layout_id: "MAAT2", observer: "MAAT2_HUB", packet_type: "HUB_STATE_SNAPSHOT"},
  MAAT2_TIME: {layout_id: "MAAT2", observer: "MAAT2_TIME", packet_type: "TIME_ENGINE_SNAPSHOT"},
});
const FRESHNESS = new Set(["FRESH", "AGING", "STALE", "EXPIRED", "INVALID_CLOCK"]);
const QUALITY = new Set(["GOOD", "LIMITED", "WATCH", "INVALID"]);

function unavailable(reason) {
  return {available: false, reason};
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateValidationResponse(value, view, timeframe) {
  const identity = VIEW_IDENTITY[view];
  if (!identity || !TIMEFRAMES.has(timeframe) || !isRecord(value) || value.ok !== true) return unavailable("INVALID_RESPONSE");
  if (value.api_schema_version !== API_SCHEMA_VERSION || value.view !== view) return unavailable("API_SCHEMA_MISMATCH");
  if (!isRecord(value.source) || !isRecord(value.instrument) || !isRecord(value.bar) || !isRecord(value.quality) || !isRecord(value.freshness) || !isRecord(value.payload)) return unavailable("INVALID_RESPONSE");

  const expectedSource = {
    schema_version: "as1.v1.4",
    satellite_id: "AS1",
    platform: "TRADINGVIEW",
    source_profile_code: SOURCE_PROFILE,
    ...identity,
  };
  for (const [key, expected] of Object.entries(expectedSource)) {
    if (value.source[key] !== expected) return unavailable("IDENTITY_MISMATCH");
  }
  if (value.instrument.ticker_id !== TICKER_ID || value.timeframe !== timeframe) return unavailable("IDENTITY_MISMATCH");
  if (!isFiniteNumber(value.bar.close) || !Number.isSafeInteger(value.bar.open_time) || !Number.isSafeInteger(value.bar.close_time) || value.bar.open_time >= value.bar.close_time) return unavailable("INVALID_BAR");
  if (!QUALITY.has(value.quality.sensor_quality) || typeof value.quality.valid !== "boolean" || !Array.isArray(value.quality.flags) || value.quality.flags.some((flag) => typeof flag !== "string")) return unavailable("INVALID_QUALITY");
  if (!FRESHNESS.has(value.freshness.state) || !isFiniteNumber(value.freshness.age_seconds) || !isFiniteNumber(value.freshness.cadence_seconds)) return unavailable("INVALID_FRESHNESS");
  if (typeof value.received_at !== "string" || !Number.isFinite(Date.parse(value.received_at))) return unavailable("INVALID_RECEIVED_AT");

  return {
    available: true,
    view,
    timeframe,
    barCloseTime: value.bar.close_time,
    receivedAt: value.received_at,
    quality: {
      sensorQuality: value.quality.sensor_quality,
      valid: value.quality.valid,
      flags: [...value.quality.flags],
    },
    freshness: value.freshness.state,
    payload: value.payload,
  };
}

export async function fetchValidationObservation({
  view,
  timeframe = "240",
  fetchImpl = globalThis.fetch,
  timeoutMs = AS1_VALIDATION_TIMEOUT_MS,
} = {}) {
  if (!Object.hasOwn(VIEW_IDENTITY, view) || !TIMEFRAMES.has(timeframe) || typeof fetchImpl !== "function") return unavailable("INVALID_REQUEST");
  const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(timeoutMs, AS1_VALIDATION_TIMEOUT_MS)
    : AS1_VALIDATION_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
  const url = new URL(AS1_VALIDATION_ENDPOINT);
  url.searchParams.set("view", view);
  url.searchParams.set("timeframe", timeframe);

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response || response.ok !== true) return unavailable(response?.status === 404 ? "NO_OBSERVATION" : "HTTP_ERROR");
    let body;
    try {
      body = await response.json();
    } catch {
      return unavailable("MALFORMED_JSON");
    }
    return validateValidationResponse(body, view, timeframe);
  } catch (error) {
    return unavailable(controller.signal.aborted || error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchValidationCards({timeframe = "240", fetchImpl = globalThis.fetch} = {}) {
  const [maat, hub, time] = await Promise.all([
    fetchValidationObservation({view: "MAAT", timeframe, fetchImpl}),
    fetchValidationObservation({view: "MAAT2_HUB", timeframe, fetchImpl}),
    fetchValidationObservation({view: "MAAT2_TIME", timeframe, fetchImpl}),
  ]);
  const synchronized = hub.available && time.available && hub.barCloseTime === time.barCloseTime;
  return {timeframe, maat, maat2: {hub, time, synchronized}};
}
