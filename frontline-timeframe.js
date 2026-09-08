"use strict";

export const FRONTLINE_TIMEFRAMES = Object.freeze(["1H", "2H", "4H", "6H", "8H", "12H", "1D"]);

const unavailable = (state) => ({state, observed: false, freshness: null});

function btcState(observation) {
  if (!observation) return unavailable("WAITING");
  if (observation.available !== true) return unavailable(observation.reason === "INVALID_OBSERVATION" ? "INVALID" : "NO DATA");
  if (observation.quality?.valid !== true || observation.quality?.sensorQuality === "INVALID") return unavailable("INVALID");
  if (observation.freshness === "STALE" || observation.freshness === "EXPIRED" || observation.freshness === "INVALID_CLOCK") return unavailable("STALE");
  return {state: "LIVE", observed: true, freshness: observation.freshness ?? null};
}

function assetState(assetObservation, timeframe) {
  if (!assetObservation) return unavailable("WAITING");
  if (assetObservation.available !== true) return unavailable("WAITING");
  if (assetObservation.status === "PLANNED") return unavailable("PLANNED");
  if (assetObservation.status === "INVALID") return unavailable("INVALID");
  if (assetObservation.status === "STALE") return unavailable("STALE");
  const receipt = assetObservation.timeframes?.[timeframe];
  if (!receipt) return unavailable("NO DATA");
  if (receipt.valid !== true || receipt.sensorQuality === "INVALID") return unavailable("INVALID");
  if (receipt.freshness === "STALE") return unavailable("STALE");
  return {state: "LIVE", observed: true, freshness: receipt.freshness ?? null};
}

export function buildFrontlineTimeframes({assetId, entitled, btcSnapshot, assetObservation, activeTimeframe = "4H"} = {}) {
  return Object.freeze(FRONTLINE_TIMEFRAMES.map((timeframe) => {
    const status = !entitled
      ? unavailable("LOCKED")
      : assetId === "BTCUSD"
        ? btcState(btcSnapshot?.timeframes?.[timeframe])
        : assetState(assetObservation, timeframe);
    return Object.freeze({timeframe, active: timeframe === activeTimeframe, ...status});
  }));
}

export function renderFrontlineTimeframes(container, items, displayState = (state) => state, labels = {}) {
  if (!container) return;
  container.replaceChildren(...items.map((item) => {
    const card = document.createElement("article");
    card.className = `frontline-timeframe-card is-${item.state.toLowerCase().replaceAll(" ", "-")}${item.active ? " is-priority" : ""}`;
    const node = document.createElement("span");
    node.className = "frontline-timeframe-node";
    node.setAttribute("aria-hidden", "true");
    const timeframe = document.createElement("strong");
    timeframe.textContent = item.timeframe;
    const state = document.createElement("span");
    state.className = "frontline-timeframe-state";
    state.textContent = displayState(item.state);
    const note = document.createElement("small");
    note.textContent = item.active ? (labels.leader ?? "LEADER") : item.observed ? (labels.observed ?? "OBSERVED") : displayState(item.state);
    card.append(node, timeframe, state, note);
    return card;
  }));
}

if (typeof window !== "undefined") {
  window.AiLynxFrontlineTimeframes = Object.freeze({FRONTLINE_TIMEFRAMES, buildFrontlineTimeframes, renderFrontlineTimeframes});
}
