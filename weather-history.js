"use strict";

export const WEATHER_HISTORY_LIMIT = 4;
export const weatherHistoryKey = (assetId, timeframe) => `lynx.weather.history.${assetId}.${timeframe}`;
export const lastKnownGoodKey = (assetId, timeframe) => `lynx.weather.lkg.${assetId}.${timeframe}`;

function validSnapshot(value, assetId, timeframe) {
  const recovered = value?.provenance === "RECOVERED_HISTORY";
  return value && value.assetId === assetId && value.timeframe === timeframe &&
    typeof value.observedAt === "string" && Number.isFinite(Date.parse(value.observedAt)) &&
    Number.isFinite(value.score) && value.score >= 0 && value.score <= 100 &&
    typeof value.state === "string" && typeof value.majorTimeframe === "string" &&
    ["GOOD", "WATCH", "LIMITED", "CONFLICT"].includes(value.quality) &&
    value.valid === true && (["FRESH", "AGING"].includes(value.freshness) || (recovered && value.freshness === "STALE"));
}

function validLastKnownGood(value, assetId, timeframe) {
  return value && value.assetId === assetId && value.timeframe === timeframe &&
    typeof value.observedAt === "string" && Number.isFinite(Date.parse(value.observedAt)) &&
    Number.isFinite(value.score) && value.score >= 0 && value.score <= 100 &&
    typeof value.state === "string" && ["GOOD", "WATCH", "LIMITED", "CONFLICT"].includes(value.quality) &&
    value.valid === true && value.confirmed === true && ["FRESH", "AGING", "STALE"].includes(value.freshness);
}

export function readWeatherHistory(storage, assetId, timeframe) {
  try {
    const value = JSON.parse(storage?.getItem?.(weatherHistoryKey(assetId, timeframe)) || "[]");
    return Array.isArray(value) ? value.filter((item) => validSnapshot(item, assetId, timeframe)).slice(-WEATHER_HISTORY_LIMIT) : [];
  } catch { return []; }
}

export function mergeWeatherHistory(history, snapshot) {
  if (!validSnapshot(snapshot, snapshot?.assetId, snapshot?.timeframe)) return [];
  const current = Array.isArray(history) ? history.filter((item) => validSnapshot(item, snapshot.assetId, snapshot.timeframe)) : [];
  const index = current.findIndex((item) => Number.isSafeInteger(snapshot.barCloseTime) && Number.isSafeInteger(item.barCloseTime)
    ? item.barCloseTime === snapshot.barCloseTime
    : item.observedAt === snapshot.observedAt);
  if (index >= 0) current[index] = snapshot;
  else current.push(snapshot);
  return current.slice(-WEATHER_HISTORY_LIMIT);
}

export function writeWeatherHistory(storage, history) {
  const latest = history?.at?.(-1);
  if (!latest) return false;
  try { storage?.setItem?.(weatherHistoryKey(latest.assetId, latest.timeframe), JSON.stringify(history)); return true; } catch { return false; }
}

export function readLastKnownGood(storage, assetId, timeframe) {
  try {
    const value = JSON.parse(storage?.getItem?.(lastKnownGoodKey(assetId, timeframe)) || "null");
    return validLastKnownGood(value, assetId, timeframe) ? value : null;
  } catch { return null; }
}

export function writeLastKnownGood(storage, snapshot) {
  if (!validLastKnownGood(snapshot, snapshot?.assetId, snapshot?.timeframe)) return false;
  try { storage?.setItem?.(lastKnownGoodKey(snapshot.assetId, snapshot.timeframe), JSON.stringify(snapshot)); return true; } catch { return false; }
}

if (typeof window !== "undefined") window.AiLynxWeatherHistory = Object.freeze({
  readWeatherHistory,
  mergeWeatherHistory,
  writeWeatherHistory,
  readLastKnownGood,
  writeLastKnownGood,
});
