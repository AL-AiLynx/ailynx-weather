import {ASSET_READERS} from "./asset-registry.js";

export const AS1_ASSET_ENDPOINT = "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-asset-read";
const unavailable = (reason) => ({available: false, reason});
const STATUS = new Set(["LIVE", "PLANNED", "INVALID"]);
const FRESHNESS = new Set(["FRESH", "AGING", "STALE"]);
const CURRENT_FRESHNESS = new Set(["FRESH", "AGING"]);
export const LKG_RECENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
    score: Number.isFinite(value.score) && value.score >= 0 && value.score <= 100 ? value.score : null,
  });
}

function normalizeHistoryReceipt(value, expected, asset, timeframe) {
  const receipt = normalizeReceipt(value, expected, asset, {requireValid: true});
  if (!receipt || receipt.timeframe !== timeframe || value.confirmed !== true ||
      !Number.isFinite(value.score) || value.score < 0 || value.score > 100) return null;
  return Object.freeze({...receipt, confirmed: true, score: value.score});
}

function normalizeTimeframes(value, expected, asset) {
  if (!isRecord(value)) return null;
  const normalized = Object.fromEntries(Object.entries(value).map(([timeframe, receipt]) => {
    const item = normalizeReceipt(receipt, expected, asset, {requireValid: true});
    return item?.timeframe === timeframe ? [timeframe, item] : null;
  }).filter(Boolean));
  return Object.keys(normalized).length === Object.keys(value).length ? Object.freeze(normalized) : null;
}

export function lastKnownGoodState(receipt, now = Date.now()) {
  if (!receipt?.valid || !Number.isFinite(Date.parse(receipt.receivedAt))) return "NO DATA";
  return Math.max(0, now - Date.parse(receipt.receivedAt)) <= LKG_RECENT_MAX_AGE_MS
    ? "LAST OBSERVATION"
    : "OLD OBSERVATION";
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
    const legacyTimeframes = normalizeTimeframes(body.timeframes, expected, asset);
    const currentTimeframes = body.current_timeframes === undefined
      ? Object.freeze(Object.fromEntries(Object.entries(legacyTimeframes || {}).filter(([, receipt]) => CURRENT_FRESHNESS.has(receipt.freshness))))
      : normalizeTimeframes(body.current_timeframes, expected, asset);
    const lastKnownGoodTimeframes = body.last_known_good_timeframes === undefined
      ? legacyTimeframes
      : normalizeTimeframes(body.last_known_good_timeframes, expected, asset);
    if ((body.latest_receipt !== null && !latestReceipt) || !legacyTimeframes || !currentTimeframes || !lastKnownGoodTimeframes) return unavailable("IDENTITY_MISMATCH");
    const receipts = Object.values(currentTimeframes);
    const hasLiveReceipt = receipts.some((receipt) => CURRENT_FRESHNESS.has(receipt.freshness));
    const status = hasLiveReceipt ? "LIVE" : latestReceipt?.valid === true ? "STALE" : latestReceipt ? "INVALID" : "PLANNED";
    return Object.freeze({
      available: true,
      asset,
      tickerId: expected.tickerId,
      sourceProfileCode: expected.sourceProfileCode,
      status,
      latestReceipt,
      timeframes: lastKnownGoodTimeframes,
      currentTimeframes,
      lastKnownGoodTimeframes,
    });
  } catch (error) { return unavailable(signal?.aborted || error?.name === "AbortError" ? "ABORTED" : "NETWORK_ERROR"); }
}


export async function fetchAssetHistory({asset, timeframe, limit = 4, fetchImpl = globalThis.fetch, signal, endpoint = AS1_ASSET_ENDPOINT, headers = {}} = {}) {
  const expected = ASSET_READERS[asset];
  const normalizedLimit = Number.isInteger(limit) && limit >= 1 && limit <= 4 ? limit : null;
  if (!expected || typeof timeframe !== "string" || !timeframe || !normalizedLimit || typeof fetchImpl !== "function") return unavailable("INVALID_HISTORY_REQUEST");
  const url = new URL(endpoint);
  url.searchParams.set("asset", asset);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("limit", String(normalizedLimit));
  try {
    const response = await fetchImpl(url, {method: "GET", cache: "no-store", credentials: "omit", redirect: "error", headers, ...(signal ? {signal} : {})});
    if (!response.ok) return unavailable(response.status === 404 ? "NO_OBSERVATION" : "HTTP_ERROR");
    const body = await response.json();
    if (body?.ok !== true || body.asset !== asset || body.ticker_id !== expected.tickerId ||
        body.source_profile_code !== expected.sourceProfileCode || !Array.isArray(body.history)) return unavailable("IDENTITY_MISMATCH");
    const history = body.history.map((item) => normalizeHistoryReceipt(item, expected, asset, timeframe));
    if (history.some((item) => item === null) || history.length > normalizedLimit) return unavailable("IDENTITY_MISMATCH");
    const ordered = [...history].sort((a, b) => a.barCloseTime - b.barCloseTime || Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
    if (ordered.some((item, index) => index > 0 && item.barCloseTime <= ordered[index - 1].barCloseTime)) return unavailable("IDENTITY_MISMATCH");
    return Object.freeze({available: true, asset, timeframe, history: Object.freeze(ordered)});
  } catch (error) { return unavailable(signal?.aborted || error?.name === "AbortError" ? "ABORTED" : "NETWORK_ERROR"); }
}
