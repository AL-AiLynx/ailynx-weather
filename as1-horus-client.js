export const AS1_HORUS_ENDPOINT = "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-horus-read";
export const AS1_HORUS_TIMEOUT_MS = 7000;
export const HORUS_TIMEFRAMES = Object.freeze([...Array.from({length: 23}, (_, i) => `${i + 1}H`), "1D", "2D", "3D", "4D", "5D", "6D", "1W"]);
const SCHEMA = "as1-horus-read.v1";
const FRESHNESS = new Set(["FRESH", "AGING", "STALE", "EXPIRED", "INVALID_CLOCK"]);
const QUALITY = new Set(["GOOD", "LIMITED", "WATCH", "INVALID"]);
const unavailable = (reason) => ({available: false, reason});
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const scalar = (value) => value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));

function normalize(value, timeframe) {
  if (!record(value)) return null;
  if (value.available === false) return ["NO_OBSERVATION", "INVALID_OBSERVATION"].includes(value.reason) ? unavailable(value.reason) : null;
  if (value.available !== true || value.series !== "HORUS_A" || value.timeframe !== timeframe || value.symbol !== "BTCUSD" || value.ticker_id !== "COINBASE:BTCUSD" || !record(value.bar) || !Number.isFinite(value.bar.close) || !Number.isSafeInteger(value.bar_close_time) || value.bar_close_time <= 0 || typeof value.received_at !== "string" || !Number.isFinite(Date.parse(value.received_at)) || !record(value.quality) || !QUALITY.has(value.quality.sensor_quality) || typeof value.quality.valid !== "boolean" || !Array.isArray(value.quality.flags) || value.quality.flags.some((flag) => typeof flag !== "string") || !record(value.freshness) || !FRESHNESS.has(value.freshness.state) || !Number.isFinite(value.freshness.age_seconds) || value.freshness.age_seconds < 0 || !Number.isFinite(value.freshness.cadence_seconds) || value.freshness.cadence_seconds <= 0 || !record(value.state) || Object.values(value.state).some((item) => !scalar(item))) return null;
  return {available: true, symbol: value.symbol, tickerId: value.ticker_id, timeframe, bar: {close: value.bar.close}, barCloseTime: value.bar_close_time, receivedAt: value.received_at, freshness: value.freshness.state, ageSeconds: value.freshness.age_seconds, cadenceSeconds: value.freshness.cadence_seconds, quality: {sensorQuality: value.quality.sensor_quality, valid: value.quality.valid, flags: [...value.quality.flags]}, state: {...value.state}};
}

export function validateHorusResponse(value) {
  if (!record(value) || value.ok !== true) return {applied: false, reason: "INVALID_RESPONSE"};
  if (value.api_schema_version !== SCHEMA) return {applied: false, reason: "API_SCHEMA_MISMATCH"};
  if (!record(value.instrument) || value.instrument.ticker_id !== "COINBASE:BTCUSD" || value.instrument.symbol !== "BTCUSD" || !record(value.timeframes)) return {applied: false, reason: "IDENTITY_MISMATCH"};
  const timeframes = Object.fromEntries(HORUS_TIMEFRAMES.map((timeframe) => [timeframe, normalize(value.timeframes[timeframe], timeframe)]));
  return Object.values(timeframes).some((item) => item === null) ? {applied: false, reason: "INVALID_OBSERVATION"} : {applied: true, updatedAt: value.updated_at ?? null, timeframes};
}

export async function fetchHorusSnapshot({fetchImpl = globalThis.fetch, timeoutMs = AS1_HORUS_TIMEOUT_MS} = {}) {
  if (typeof fetchImpl !== "function") return {applied: false, reason: "FETCH_UNAVAILABLE"};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1), AS1_HORUS_TIMEOUT_MS));
  try {
    const response = await fetchImpl(AS1_HORUS_ENDPOINT, {method: "GET", cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal});
    if (!response?.ok) return {applied: false, reason: response?.status >= 500 ? "HTTP_5XX" : "HTTP_4XX"};
    try { return validateHorusResponse(await response.json()); } catch { return {applied: false, reason: "MALFORMED_JSON"}; }
  } catch (error) { return {applied: false, reason: controller.signal.aborted || error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR"}; }
  finally { clearTimeout(timeoutId); }
}
