"use strict";

const clampScore = (value) => Math.round(Math.max(0, Math.min(100, value)));

const bands = Object.freeze({
  persistence: Object.freeze([[80, "매우 강함"], [65, "강함"], [45, "보통"], [25, "약함"], [0, "매우 약함"]]),
  changeRate: Object.freeze([[80, "매우 빠름"], [60, "빠름"], [40, "보통"], [20, "안정"], [0, "매우 안정"]]),
});

export function metricPresentation(value, kind, observationCount = 0) {
  if (!Number.isFinite(value) || !bands[kind]) {
    const count = Number.isInteger(observationCount) && observationCount > 0 ? Math.min(observationCount, 1) : 0;
    return Object.freeze({ready: false, value: null, band: "관측 축적 중", note: `관측 ${count} / 2 · 유효 관측이 쌓이면 표시합니다.`});
  }
  const score = clampScore(value);
  const [, band] = bands[kind].find(([minimum]) => score >= minimum);
  return Object.freeze({ready: true, value: score, band, note: ""});
}

export function leaderPresentation(value) {
  return Object.freeze({value: typeof value === "string" && /^(?:1H|4H|6H|8H|12H|1D|24H)$/.test(value) ? value : "—"});
}

export function hasCoreTransition(previous, next) {
  return previous !== undefined && previous !== next;
}

if (typeof window !== "undefined") window.AiLynxCoreDynamics = Object.freeze({metricPresentation, leaderPresentation, hasCoreTransition});
