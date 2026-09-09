import {ASSET_READERS} from "./asset-registry.js";

export const AS1_ASSET_ENDPOINT = "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-asset-read";
const unavailable = (reason) => ({available: false, reason});
const STATUS = new Set(["LIVE", "PLANNED", "INVALID"]);
const FRESHNESS = new Set(["FRESH", "AGING", "STALE"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeReceipt(value, expected, asset, {requireValid = false} = {}) {
  if (!isRecord(value) || value.asset !== asset || value.symbol !== expected.id ||
      value.ticker_id !== expected.tickerId || typeof value.timeframe !== "string" ||
      typeof value.received_at !== "string" || !Number.isFinite(Date.parse(value.received_at)) ||
      !Number.isSafeInteger(value.bar_close_time) || value.bar_close_time <= 0 ||
      !Number.isFinite(value.bar_close) || typeof value.valid !== "boolean" ||
      typeof value.sensor_quality !== "string" || !FRESHNESS.has(value.freshness) ||
      !Array.isArray(value.flags) || value.flags.some((flag) => typeof flag !== "string") ||
      (requireValid && value.valid !== true)) return null;
  return Object.freeze({
    asset,
    symbol: expected.id,
    tickerId: expected.tickerId,
    timeframe: value.timeframe,
    receivedAt: value.received_at,
    barCloseTime: value.bar_close_time,
    barClose: value.bar_close,
    valid: value.valid,
    sensorQuality: value.sensor_quality,
    freshness: value.freshness,
    flags: Object.freeze([...value.flags]),
  });
}

export async function fetchAssetObservations({asset, fetchImpl = globalThis.fetch, signal, endpoint = AS1_ASSET_ENDPOINT, headers = {}} = {}) {
  const expected = ASSET_READERS[asset];
  if (!expected || typeof fetchImpl !== "function") return unavailable("UNSUPPORTED_ASSET");
  const url = new URL(endpoint); url.searchParams.set("asset", asset);
  try {
    const response = await fetchImpl(url, {method: "GET", cache: "no-store", credentials: "omit", redirect: "error", headers, ...(signal ? {signal} : {})});
    if (!response.ok) return unavailable(response.status === 404 ? "NO_OBSERVATION" : "HTTP_ERROR");
    const body = await response.json();
    if (body?.ok !== true || body.asset !== asset || body.ticker_id !== expected.tickerId ||
        body.source_profile_code !== expected.sourceProfileCode || !STATUS.has(body.status) ||
        !isRecord(body.timeframes)) return unavailable("IDENTITY_MISMATCH");
    const latestReceipt = body.latest_receipt === null ? null : normalizeReceipt(body.latest_receipt, expected, asset);
    const timeframes = Object.fromEntries(Object.entries(body.timeframes).map(([timeframe, receipt]) => {
      const normalized = normalizeReceipt(receipt, expected, asset, {requireValid: true});
      return normalized?.timeframe === timeframe ? [timeframe, normalized] : null;
    }).filter(Boolean));
    if ((body.latest_receipt !== null && !latestReceipt) || Object.keys(timeframes).length !== Object.keys(body.timeframes).length) return unavailable("IDENTITY_MISMATCH");
    const receipts = Object.values(timeframes);
    const hasLiveReceipt = receipts.some((receipt) => receipt.freshness !== "STALE");
    const status = hasLiveReceipt ? "LIVE" : latestReceipt?.valid === true ? "STALE" : latestReceipt ? "INVALID" : "PLANNED";
    return Object.freeze({available: true, asset, tickerId: expected.tickerId, sourceProfileCode: expected.sourceProfileCode, status, latestReceipt, timeframes: Object.freeze(timeframes)});
  } catch (error) { return unavailable(signal?.aborted || error?.name === "AbortError" ? "ABORTED" : "NETWORK_ERROR"); }
}
