import assert from "node:assert/strict";
import test from "node:test";
import {FRONTLINE_TIMEFRAMES, buildFrontlineTimeframes} from "../frontline-timeframe.js";

const btcObservation = (freshness = "FRESH", overrides = {}) => ({available: true, freshness, quality: {valid: true, sensorQuality: "GOOD"}, ...overrides});
const assetReceipt = (freshness = "FRESH", overrides = {}) => ({valid: true, sensorQuality: "GOOD", freshness, ...overrides});

test("frontline builds the required horizontal priority timeframe sequence", () => {
  const items = buildFrontlineTimeframes({assetId: "BTCUSD", entitled: true, activeTimeframe: "4H", btcSnapshot: {timeframes: {"1H": btcObservation(), "4H": btcObservation("AGING"), "1D": btcObservation("STALE")}}});
  assert.deepEqual(items.map((item) => item.timeframe), FRONTLINE_TIMEFRAMES);
  assert.equal(items.find((item) => item.timeframe === "4H").active, true);
  assert.equal(items.find((item) => item.timeframe === "4H").state, "LIVE");
  assert.equal(items.find((item) => item.timeframe === "1D").state, "STALE");
  assert.equal(items.find((item) => item.timeframe === "6H").state, "WAITING");
});

test("non-BTC PLANNED state does not borrow BTC observations", () => {
  const items = buildFrontlineTimeframes({assetId: "XAUUSD", entitled: true, activeTimeframe: "4H", btcSnapshot: {timeframes: {"4H": btcObservation()}}, assetObservation: {available: true, status: "PLANNED", latestReceipt: null, timeframes: {}}});
  assert.ok(items.every((item) => item.state === "PLANNED"));
  assert.ok(items.every((item) => item.observed === false));
});

test("asset-local valid receipts alone make their matching timeframes LIVE", () => {
  const items = buildFrontlineTimeframes({assetId: "US100", entitled: true, activeTimeframe: "1D", assetObservation: {available: true, status: "LIVE", timeframes: {"4H": assetReceipt(), "1D": assetReceipt("AGING")}}});
  assert.equal(items.find((item) => item.timeframe === "4H").state, "LIVE");
  assert.equal(items.find((item) => item.timeframe === "1D").state, "LIVE");
  assert.equal(items.find((item) => item.timeframe === "6H").state, "NO DATA");
});

test("locked and invalid states expose no receipt data", () => {
  const locked = buildFrontlineTimeframes({assetId: "DXY", entitled: false, assetObservation: {available: true, status: "LIVE", timeframes: {"4H": assetReceipt()}}});
  assert.ok(locked.every((item) => item.state === "LOCKED" && item.observed === false));
  const invalid = buildFrontlineTimeframes({assetId: "DXY", entitled: true, assetObservation: {available: true, status: "INVALID", timeframes: {}}});
  assert.ok(invalid.every((item) => item.state === "INVALID" && item.observed === false));
});
