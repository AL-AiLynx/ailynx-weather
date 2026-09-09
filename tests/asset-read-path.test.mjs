import assert from "node:assert/strict";
import test from "node:test";
import {createAssetReadPath} from "../asset-read-path.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
};
const observation = (asset, status = "PLANNED") => ({available: true, asset, status, latestReceipt: null, timeframes: {}});

test("asset switching discards a stale earlier response", async () => {
  const pending = new Map();
  const path = createAssetReadPath({fetchObservation: ({asset}) => { const item = deferred(); pending.set(asset, item); return item.promise; }});
  const xau = path.select("XAUUSD");
  const dxy = path.select("DXY");
  pending.get("DXY").resolve(observation("DXY"));
  assert.equal((await dxy).applied, true);
  pending.get("XAUUSD").resolve(observation("XAUUSD"));
  assert.equal((await xau).reason, "STALE_SELECTION");
  assert.equal(path.snapshot().assetId, "DXY");
  assert.equal(path.snapshot().observation.asset, "DXY");
});

test("BTC, XAUUSD, DXY, and US100 transitions never retain a prior asset observation", async () => {
  const path = createAssetReadPath({fetchObservation: async ({asset}) => observation(asset)});
  await path.select("BTCUSD");
  assert.equal(path.snapshot().observation, null);
  for (const asset of ["XAUUSD", "DXY", "US100"]) {
    await path.select(asset);
    assert.equal(path.snapshot().assetId, asset);
    assert.equal(path.snapshot().observation.asset, asset);
  }
});

test("locked assets do not fetch or expose a cached receipt", async () => {
  let calls = 0;
  const path = createAssetReadPath({canReadAsset: (asset) => asset !== "XAUUSD", fetchObservation: async () => { calls += 1; return observation("XAUUSD", "LIVE"); }});
  const result = await path.select("XAUUSD");
  assert.equal(result.reason, "LOCKED");
  assert.equal(calls, 0);
  assert.equal(path.snapshot().observation, null);
});

test("FREE can fetch US100 while Plus assets remain fetch-blocked", async () => {
  const freeAssets = new Set(["BTCUSD", "US100"]);
  const fetched = [];
  const path = createAssetReadPath({
    canReadAsset: (asset) => freeAssets.has(asset),
    fetchObservation: async ({asset}) => {
      fetched.push(asset);
      return observation(asset, "LIVE");
    },
  });
  const us100 = await path.select("US100");
  assert.equal(us100.applied, true);
  assert.equal(path.snapshot().observation.asset, "US100");
  const xauusd = await path.select("XAUUSD");
  const dxy = await path.select("DXY");
  assert.equal(xauusd.reason, "LOCKED");
  assert.equal(dxy.reason, "LOCKED");
  assert.deepEqual(fetched, ["US100"]);
  assert.equal(path.snapshot().observation, null);
});

test("a plan downgrade clears an in-memory paid receipt before rendering can reuse it", async () => {
  let weatherPlan = true;
  const path = createAssetReadPath({canReadAsset: (asset) => asset !== "XAUUSD" || weatherPlan, fetchObservation: async ({asset}) => observation(asset, "LIVE")});
  await path.select("XAUUSD");
  assert.equal(path.snapshot().observation.asset, "XAUUSD");
  weatherPlan = false;
  const next = path.reconcileAccess();
  assert.equal(next.observation, null);
  assert.equal(path.snapshot().observation, null);
});

test("unsupported assets fail before changing the selected asset", async () => {
  const path = createAssetReadPath();
  const result = await path.select("EURUSD");
  assert.equal(result.reason, "UNSUPPORTED_ASSET");
  assert.equal(path.snapshot().assetId, "BTCUSD");
});
