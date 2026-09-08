import assert from "node:assert/strict";
import test from "node:test";
import {buildWeatherFlow} from "../weather-dynamics.js";

function observation(index, overrides = {}) {
  return {
    assetId: "BTCUSD",
    timeframe: "4H",
    observedAt: `2026-09-08T0${index}:00:00.000Z`,
    score: 40 + index * 10,
    valid: true,
    freshness: "FRESH",
    ...overrides,
  };
}

test("weather flow stays in its selected asset and timeframe", () => {
  const flow = buildWeatherFlow([
    observation(0),
    observation(1),
    observation(2, {assetId: "XAUUSD"}),
    observation(3, {timeframe: "1D"}),
  ], {assetId: "BTCUSD", timeframe: "4H"});
  assert.equal(flow.state, "READY");
  assert.equal(flow.observations.length, 2);
  assert.match(flow.linePath, /^M/);
  assert.match(flow.areaPath, /Z$/);
});

test("weather flow renders an empty model until two valid observations exist", () => {
  const empty = buildWeatherFlow([observation(0)], {assetId: "BTCUSD", timeframe: "4H"});
  assert.equal(empty.state, "EMPTY");
  assert.equal(empty.linePath, "");
  const stale = buildWeatherFlow([observation(0), observation(1, {freshness: "STALE"})], {assetId: "BTCUSD", timeframe: "4H"});
  assert.equal(stale.state, "EMPTY");
});

test("weather flow uses no more than the four latest observations", () => {
  const flow = buildWeatherFlow(Array.from({length: 5}, (_, index) => observation(index)), {assetId: "BTCUSD", timeframe: "4H"});
  assert.equal(flow.points.length, 4);
  assert.equal(flow.observations[0].observedAt, observation(1).observedAt);
  assert.equal(flow.points.at(-1).score, 80);
});
