"use strict";

const CURRENT = new Set(["FRESH", "AGING"]);
const KNOWN = new Set(["FRESH", "AGING", "STALE"]);

function normalizeWeatherTimeframe(value) {
  if (value === "D" || value === "1D" || value === "1440" || value === "24H") return "1D";
  if (value === "W" || value === "1W") return "1W";
  if (typeof value === "string" && /^\d+D$/.test(value)) return value;
  if (typeof value === "string" && /^\d+H$/.test(value)) return value;
  const minutes = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(minutes) || minutes < 60 || minutes % 60 !== 0) return null;
  return minutes % 1440 === 0 ? `${minutes / 1440}D` : `${minutes / 60}H`;
}

function receiptValue(receipt, key) {
  return receipt?.[key] ?? receipt?.quality?.[key] ?? receipt?.state?.[key];
}

function isCurrent(receipt) {
  return receipt?.confirmed === true && receiptValue(receipt, "valid") === true && CURRENT.has(receipt?.freshness);
}

function isKnownGood(receipt) {
  return receipt?.confirmed === true && receiptValue(receipt, "valid") === true && KNOWN.has(receipt?.freshness);
}

function classify(score) {
  return globalThis.AiLynxWeatherEngine?.classifyWeather?.(score) ?? null;
}

function buildWeatherViewModel({asset, timeframe, current = null, lastKnownGood = null, score, quality, timestamp, fallbackStatus = "NO DATA", now = Date.now()} = {}) {
  const normalizedTimeframe = normalizeWeatherTimeframe(timeframe);
  const currentReceipt = isCurrent(current) ? current : null;
  const lkgReceipt = !currentReceipt && isKnownGood(lastKnownGood) ? lastKnownGood : null;
  const receipt = currentReceipt ?? lkgReceipt;
  const resolvedScore = Number.isFinite(score) ? score : receiptValue(receipt, "score");
  const classified = Number.isFinite(resolvedScore) ? classify(resolvedScore) : null;
  const isLkg = Boolean(lkgReceipt);
  const freshness = receipt?.freshness ?? null;
  const sourceQuality = quality ?? receiptValue(receipt, "sensorQuality") ?? "WATCH";
  const receivedAt = Date.parse(timestamp ?? receipt?.receivedAt ?? "");
  const status = receipt ? isLkg ? (Number.isFinite(receivedAt) && Math.max(0, now - receivedAt) > 24 * 60 * 60 * 1000 ? "OLD OBSERVATION" : "LAST OBSERVATION") : freshness : fallbackStatus;
  return Object.freeze({
    asset: typeof asset === "string" ? asset : null,
    timeframe: normalizedTimeframe,
    score: Number.isFinite(resolvedScore) ? resolvedScore : null,
    state: classified?.state ?? null,
    label: classified?.label ?? null,
    icon: classified?.icon ?? null,
    freshness,
    liveStatus: status,
    quality: sourceQuality,
    timestamp: timestamp ?? receipt?.receivedAt ?? null,
    isLkg,
    source: receipt ? isLkg ? "LAST_KNOWN_GOOD" : "CURRENT" : "NONE",
  });
}

function buildMetricHistory({asset, timeframe, receipts = []} = {}) {
  const normalizedTimeframe = normalizeWeatherTimeframe(timeframe);
  if (!normalizedTimeframe || !Array.isArray(receipts)) return Object.freeze([]);
  return Object.freeze(receipts.map((receipt) => {
    if (normalizeWeatherTimeframe(receipt?.timeframe) !== normalizedTimeframe) return null;
    const view = buildWeatherViewModel({asset, timeframe: normalizedTimeframe, current: receipt});
    if (view.source !== "CURRENT" || !Number.isFinite(view.score) || !view.state) return null;
    return Object.freeze({assetId: asset, timeframe: normalizedTimeframe, majorTimeframe: normalizedTimeframe, score: view.score, state: view.state, valid: true, noise: 0, quality: view.quality === "GOOD" ? "GOOD" : view.quality === "LIMITED" ? "LIMITED" : "WATCH", freshness: view.freshness, observedAt: view.timestamp});
  }).filter(Boolean));
}

if (typeof window !== "undefined") window.AiLynxWeatherViewModel = Object.freeze({normalizeWeatherTimeframe, buildWeatherViewModel, buildMetricHistory});
