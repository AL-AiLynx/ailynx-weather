export const AS1_LIVE_ENDPOINT =
  "https://ofcvmsbejmwcgdymgkdj.supabase.co/functions/v1/as1-weather-read";

export const AS1_LIVE_TIMEOUT_MS = 5000;

const API_SCHEMA_VERSION = "as1-weather-read.v1";
const CADENCE_SECONDS = 14_400;
const ALLOWED_FRESHNESS = new Set(["FRESH", "AGING"]);
const KNOWN_FRESHNESS = new Set([
  "FRESH",
  "AGING",
  "STALE",
  "EXPIRED",
  "INVALID_CLOCK",
]);
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const FIXED_IDENTITY = Object.freeze({
  schema_version: "as1.v1.3",
  satellite_id: "AS1",
  platform: "TRADINGVIEW",
  layout_id: "HORUS_A",
  observer: "HORUS",
  source_profile_code: "CB_BTCUSD_SPOT_20260722_V1",
  ticker_id: "COINBASE:BTCUSD",
  venue: "COINBASE",
  symbol: "BTCUSD",
  timeframe: "240",
  sensor_quality: "GOOD",
});

function fallback(reason) {
  return { applied: false, reason };
}

function isRecord(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" &&
    ISO_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value));
}

function timeValueMilliseconds(value) {
  if (Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (isIsoTimestamp(value)) {
    return Date.parse(value);
  }

  return null;
}

export function validateAs1LiveResponse(value) {
  if (!isRecord(value)) {
    return fallback("EMPTY_RESPONSE");
  }

  if (value.ok !== true) {
    return fallback("API_NOT_OK");
  }

  if (value.api_schema_version !== API_SCHEMA_VERSION) {
    return fallback("API_SCHEMA_MISMATCH");
  }

  if (!isRecord(value.source) || !isRecord(value.instrument)) {
    return fallback("IDENTITY_MISMATCH");
  }

  for (const key of [
    "schema_version",
    "satellite_id",
    "platform",
    "layout_id",
    "observer",
    "source_profile_code",
  ]) {
    if (value.source[key] !== FIXED_IDENTITY[key]) {
      return fallback("IDENTITY_MISMATCH");
    }
  }

  for (const key of ["ticker_id", "venue", "symbol"]) {
    if (value.instrument[key] !== FIXED_IDENTITY[key]) {
      return fallback("INSTRUMENT_MISMATCH");
    }
  }

  if (value.timeframe !== FIXED_IDENTITY.timeframe) {
    return fallback("TIMEFRAME_MISMATCH");
  }

  if (
    !isRecord(value.quality) ||
    value.quality.sensor_quality !== FIXED_IDENTITY.sensor_quality ||
    value.quality.valid !== true ||
    !Array.isArray(value.quality.flags)
  ) {
    return fallback("QUALITY_MISMATCH");
  }

  if (
    !isRecord(value.bar) ||
    typeof value.bar.close !== "number" ||
    !Number.isFinite(value.bar.close) ||
    value.bar.close <= 0
  ) {
    return fallback("INVALID_CLOSE");
  }

  const barOpenTime = timeValueMilliseconds(value.bar.open_time);
  const barCloseTime = timeValueMilliseconds(value.bar.close_time);

  if (
    barOpenTime === null ||
    barCloseTime === null ||
    barOpenTime >= barCloseTime
  ) {
    return fallback("INVALID_BAR_TIME");
  }

  if (!isIsoTimestamp(value.received_at)) {
    return fallback("INVALID_RECEIVED_AT");
  }

  if (
    !isRecord(value.freshness) ||
    !KNOWN_FRESHNESS.has(value.freshness.state) ||
    typeof value.freshness.age_seconds !== "number" ||
    !Number.isFinite(value.freshness.age_seconds) ||
    value.freshness.age_seconds < 0 ||
    value.freshness.cadence_seconds !== CADENCE_SECONDS
  ) {
    return fallback("FRESHNESS_MISMATCH");
  }

  if (!ALLOWED_FRESHNESS.has(value.freshness.state)) {
    return fallback(value.freshness.state);
  }

  return {
    applied: true,
    price: value.bar.close,
    timeframe: "4H",
    receivedAt: value.received_at,
    barCloseTime: value.bar.close_time,
    freshness: value.freshness.state,
  };
}

export async function fetchAs1LiveObservation({
  fetchImpl = globalThis.fetch,
  timeoutMs = AS1_LIVE_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return fallback("FETCH_UNAVAILABLE");
  }

  const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(timeoutMs, AS1_LIVE_TIMEOUT_MS)
    : AS1_LIVE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    effectiveTimeout,
  );

  try {
    const response = await fetchImpl(AS1_LIVE_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response || response.ok !== true) {
      const status = Number(response?.status);

      if (Number.isFinite(status) && status >= 500) {
        return fallback("HTTP_5XX");
      }

      return fallback("HTTP_4XX");
    }

    let body;

    try {
      body = await response.json();
    } catch {
      return fallback("MALFORMED_JSON");
    }

    return validateAs1LiveResponse(body);
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      return fallback("TIMEOUT");
    }

    return fallback("NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}
