import {fetchValidationObservation} from "./as1-validation-client.js";

// Public reader selection. The currently deployed validation API only exposes
// BTCUSD MAAT/MAAT2 observations; unsupported selections fail closed.
export const AS1_OBSERVATION_READERS = Object.freeze({
  MAAT: Object.freeze({asset: "COINBASE:BTCUSD", observer: "MAAT", packetType: "VALIDATION_SNAPSHOT", view: "MAAT"}),
  MAAT2_HUB: Object.freeze({asset: "COINBASE:BTCUSD", observer: "MAAT2_HUB", packetType: "HUB_STATE_SNAPSHOT", view: "MAAT2_HUB"}),
  MAAT2_TIME: Object.freeze({asset: "COINBASE:BTCUSD", observer: "MAAT2_TIME", packetType: "TIME_ENGINE_SNAPSHOT", view: "MAAT2_TIME"}),
});
const SUPPORTED_TIMEFRAMES = new Set(["240", "480", "720", "D", "1D", "1440"]);

function unavailable(reason) {
  return {available: false, reason};
}

function resolveReader({asset, observer, packetType, timeframe}) {
  if (typeof asset !== "string" || typeof observer !== "string" ||
      typeof packetType !== "string" || typeof timeframe !== "string" ||
      !SUPPORTED_TIMEFRAMES.has(timeframe)) return null;
  return Object.values(AS1_OBSERVATION_READERS).find((reader) =>
    reader.asset === asset && reader.observer === observer && reader.packetType === packetType,
  ) ?? null;
}

export async function fetchAs1Observation({
  asset = "COINBASE:BTCUSD",
  observer,
  packetType,
  timeframe = "240",
  fetchImpl = globalThis.fetch,
  timeoutMs,
} = {}) {
  const reader = resolveReader({asset, observer, packetType, timeframe});
  if (!reader) return unavailable("UNSUPPORTED_SELECTION");
  const result = await fetchValidationObservation({
    view: reader.view, timeframe, fetchImpl, ...(timeoutMs === undefined ? {} : {timeoutMs}),
  });
  if (!result.available) return result;
  return {
    available: true,
    asset: reader.asset,
    observer: reader.observer,
    packetType: reader.packetType,
    timeframe: result.timeframe,
    bar: result.bar,
    receivedAt: result.receivedAt,
    quality: result.quality,
    freshness: result.freshness,
    payload: result.payload,
  };
}
