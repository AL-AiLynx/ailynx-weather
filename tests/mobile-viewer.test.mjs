import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const viewer = await import("../mobile-viewer.js");

test("viewer access is restricted to actual PRO or server-verified admin", () => {
  assert.equal(viewer.mobileViewerAccess({plan: "PRO"}, false), true);
  assert.equal(viewer.mobileViewerAccess({plan: "FREE"}, true), true);
  for (const plan of ["FREE", "WEATHER", "PREMIUM"]) assert.equal(viewer.mobileViewerAccess({plan}, false), false);
});

test("viewer receipt priority stays within the requested asset and timeframe", () => {
  const receipt = (asset, timeframe) => ({asset, timeframe});
  const observation = {available: true, asset: "US100", currentTimeframes: {"1D": receipt("US100", "1D")}, lastKnownGoodTimeframes: {"4H": receipt("US100", "4H")}, recoveredTimeframes: {"4H": receipt("US100", "4H")}};
  assert.equal(viewer.selectSameTimeframeReceipt(observation, "4H").source, "LAST_KNOWN_GOOD");
  assert.equal(viewer.selectSameTimeframeReceipt(observation, "1D").source, "LIVE_CURRENT");
  assert.equal(viewer.selectSameTimeframeReceipt({...observation, currentTimeframes: {"4H": receipt("BTCUSD", "4H")}}, "4H").source, "LAST_KNOWN_GOOD");
  assert.equal(viewer.selectSameTimeframeReceipt(observation, "8H"), null);
});

test("mobile viewer route, direct gate, canonical readers, and BTC-only precision are wired", async () => {
  const [html, source, registry, config, presentation] = await Promise.all([read("mobile-viewer.html"), read("mobile-viewer.js"), read("asset-registry.js"), read("vercel.json"), read("asset-presentation.js")]);
  assert.match(config, /"source": "\/mobile-viewer"/);
  assert.match(html, /id="mobileViewerLocked"/);
  assert.match(html, /id="mobileViewerLeader"[\s\S]*hidden/);
  assert.match(source, /await refreshEntitlement\(\)/);
  assert.match(source, /membership\?\.plan === "PRO" \|\| isAdmin === true/);
  assert.match(source, /fetchAssetObservations\(\{asset\}\)/);
  assert.match(source, /fetchAssetHistory\(\{asset, timeframe: VIEW_TIMEFRAME/);
  assert.match(source, /if \(selectedAsset !== "BTCUSD"\) \{ renderPrecision\(null\); return; \}/);
  for (const asset of ["BTCUSD", "US100", "XAUUSD", "DXY"]) assert.match(registry, new RegExp(`${asset}:`));
  assert.match(source, /LIVE_CURRENT[\s\S]*LAST_KNOWN_GOOD[\s\S]*RECOVERED_HISTORY/);
  assert.match(source, /formatAssetPrice/);
  assert.match(presentation, /priceUnit/);
});
