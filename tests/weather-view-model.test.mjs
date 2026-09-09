import assert from "node:assert/strict";
import test from "node:test";
globalThis.window = globalThis;
await import("../weather-engine.js");
await import("../weather-view-model.js");
const {buildMetricHistory, buildWeatherViewModel, normalizeWeatherTimeframe} = globalThis.AiLynxWeatherViewModel;

const receipt = (overrides = {}) => ({timeframe: "4H", receivedAt: "2026-09-09T00:00:00.000Z", valid: true, confirmed: true, freshness: "FRESH", sensorQuality: "GOOD", score: 54, ...overrides});

test("one normalizer unifies hourly and daily aliases", () => {
  assert.equal(normalizeWeatherTimeframe("60"), "1H");
  assert.equal(normalizeWeatherTimeframe("240"), "4H");
  assert.equal(normalizeWeatherTimeframe("24H"), "1D");
  assert.equal(normalizeWeatherTimeframe("1440"), "1D");
  assert.equal(normalizeWeatherTimeframe("2880"), "2D");
});

test("hero, matrix, and LKG share one score state icon mapping", () => {
  const current = buildWeatherViewModel({asset: "BTCUSD", timeframe: "240", current: receipt()});
  const lkg = buildWeatherViewModel({asset: "BTCUSD", timeframe: "4H", lastKnownGood: receipt({freshness: "STALE"}), now: Date.parse("2026-09-10T01:00:00.000Z")});
  assert.equal(current.timeframe, "4H");
  assert.equal(current.state, "PARTLY_CLOUDY");
  assert.equal(current.icon, "PARTLY_CLOUDY");
  assert.equal(current.liveStatus, "FRESH");
  assert.equal(lkg.state, current.state);
  assert.equal(lkg.icon, current.icon);
  assert.equal(lkg.isLkg, true);
  assert.equal(lkg.liveStatus, "OLD OBSERVATION");
});

test("metric history excludes non-current receipts and cross-timeframe records", () => {
  const history = buildMetricHistory({asset: "BTCUSD", timeframe: "4H", receipts: [receipt(), receipt({freshness: "STALE"}), receipt({timeframe: "1H"})]});
  assert.equal(history.length, 1);
  assert.equal(history[0].timeframe, "4H");
});
