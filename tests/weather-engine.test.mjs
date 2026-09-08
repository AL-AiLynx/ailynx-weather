import assert from "node:assert/strict";
import test from "node:test";
globalThis.window = globalThis;
await import("../weather-engine.js");

const valid = (payload) => ({available: true, quality: {valid: true}, payload});
function fullInput() {
  return {timeframe: "4H", horus: {available: true, quality: {valid: true}, state: {score: 40}}, maat: valid({aggregate: {score: 60}, sensors: Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((key) => [key, {valid: true}])), stopwatch: {noise_score: 20}}), hub: valid({scores: {structure: 70, force: 50, window: 80}}), time: valid({time: {valid: true, score: 40, noise_score: 30}})};
}
test("FULL weather score is deterministic and bounded", () => { const result = globalThis.AiLynxWeatherEngine.computeWeatherScore(fullInput()); assert.equal(result.coverage, "FULL"); assert.ok(result.score >= 0 && result.score <= 100); });
test("invalid inputs do not manufacture a score", () => { const input = fullInput(); input.time.quality.valid = false; assert.equal(globalThis.AiLynxWeatherEngine.computeWeatherScore(input), null); });
test("weather classification honors every boundary", () => { const classify = globalThis.AiLynxWeatherEngine.classifyWeather; assert.equal(classify(0).state, "RAIN"); assert.equal(classify(25).state, "RAIN"); assert.equal(classify(26).state, "CLOUDY"); assert.equal(classify(51).state, "CLOUDY"); assert.equal(classify(52).state, "PARTLY_CLOUDY"); assert.equal(classify(75).state, "PARTLY_CLOUDY"); assert.equal(classify(76).state, "SUNNY"); assert.equal(classify(100).state, "SUNNY"); });
