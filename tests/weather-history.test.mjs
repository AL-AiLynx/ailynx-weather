import assert from "node:assert/strict";
import test from "node:test";
import {
  WEATHER_HISTORY_LIMIT,
  lastKnownGoodKey,
  mergeWeatherHistory,
  readLastKnownGood,
  readWeatherHistory,
  weatherHistoryKey,
  writeLastKnownGood,
  writeWeatherHistory,
} from "../weather-history.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    values,
  };
}

function snapshot(index = 0, overrides = {}) {
  return {
    assetId: "BTCUSD",
    timeframe: "4H",
    observedAt: `2026-09-08T0${index}:00:00.000Z`,
    score: 50 + index,
    state: "CLOUDY",
    majorTimeframe: "4H",
    quality: "GOOD",
    valid: true,
    freshness: "FRESH",
    ...overrides,
  };
}

test("weather history is isolated by asset and timeframe", () => {
  assert.equal(weatherHistoryKey("BTCUSD", "4H"), "lynx.weather.history.BTCUSD.4H");
  assert.notEqual(weatherHistoryKey("BTCUSD", "4H"), weatherHistoryKey("XAUUSD", "4H"));
  assert.notEqual(weatherHistoryKey("BTCUSD", "4H"), weatherHistoryKey("BTCUSD", "1D"));
  assert.equal(lastKnownGoodKey("BTCUSD", "4H"), "lynx.weather.lkg.BTCUSD.4H");
  assert.notEqual(lastKnownGoodKey("BTCUSD", "4H"), lastKnownGoodKey("XAUUSD", "4H"));
});

test("weather history deduplicates an observation and retains only four snapshots", () => {
  const history = Array.from({length: WEATHER_HISTORY_LIMIT + 1}, (_, index) => snapshot(index))
    .reduce((current, item) => mergeWeatherHistory(current, item), []);
  assert.equal(history.length, WEATHER_HISTORY_LIMIT);
  assert.equal(history[0].observedAt, snapshot(1).observedAt);

  const replacement = snapshot(4, {score: 99, state: "RAIN"});
  const updated = mergeWeatherHistory(history, replacement);
  assert.equal(updated.length, WEATHER_HISTORY_LIMIT);
  assert.equal(updated.at(-1).score, 99);
  assert.equal(updated.at(-1).state, "RAIN");
});

test("weather history rejects malformed, stale, and cross-asset persisted observations", () => {
  const storage = memoryStorage();
  storage.setItem(weatherHistoryKey("BTCUSD", "4H"), JSON.stringify([
    snapshot(0),
    snapshot(1, {assetId: "XAUUSD"}),
    snapshot(2, {freshness: "STALE"}),
    snapshot(3, {valid: false}),
    {assetId: "BTCUSD", timeframe: "4H", raw_envelope: {secret: "not persisted"}},
  ]));
  assert.deepEqual(readWeatherHistory(storage, "BTCUSD", "4H"), [snapshot(0)]);
});

test("weather history survives a reload through minimal local storage snapshots", () => {
  const storage = memoryStorage();
  const history = [snapshot(0), snapshot(1)];
  assert.equal(writeWeatherHistory(storage, history), true);
  const stored = storage.getItem(weatherHistoryKey("BTCUSD", "4H"));
  assert.ok(stored);
  assert.doesNotMatch(stored, /raw_envelope/);
  assert.deepEqual(readWeatherHistory(storage, "BTCUSD", "4H"), history);
});

test("last-known-good cache retains only a verified same-asset same-timeframe receipt", () => {
  const storage = memoryStorage();
  const lkg = {...snapshot(0, {freshness: "STALE"}), confirmed: true};
  assert.equal(writeLastKnownGood(storage, lkg), true);
  assert.deepEqual(readLastKnownGood(storage, "BTCUSD", "4H"), lkg);
  storage.setItem(lastKnownGoodKey("BTCUSD", "1D"), JSON.stringify(lkg));
  assert.equal(readLastKnownGood(storage, "BTCUSD", "1D"), null);
  assert.equal(writeLastKnownGood(storage, {...lkg, confirmed: false}), false);
});
