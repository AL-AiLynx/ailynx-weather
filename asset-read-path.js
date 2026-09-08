"use strict";

import {ASSET_READERS} from "./asset-registry.js";

const unavailable = (reason) => ({available: false, reason});

// Keeps selected-asset reads single-owner. A response may update state only if
// it still belongs to the active asset and most recent selection token.
export function createAssetReadPath({fetchObservation, canReadAsset = () => true, onChange = () => {}} = {}) {
  let assetId = "BTCUSD";
  let observation = null;
  let requestToken = 0;
  let controller = null;

  const snapshot = () => Object.freeze({
    assetId,
    observation: canReadAsset(assetId) ? observation : null,
    requestToken,
  });
  const publish = () => onChange(snapshot());

  async function select(nextAssetId) {
    if (!ASSET_READERS[nextAssetId]) return {applied: false, reason: "UNSUPPORTED_ASSET", ...snapshot()};
    controller?.abort();
    controller = null;
    assetId = nextAssetId;
    observation = null;
    const token = ++requestToken;
    publish();

    if (!canReadAsset(assetId)) return {applied: true, reason: "LOCKED", ...snapshot()};
    if (assetId === "BTCUSD") return {applied: true, reason: "BTC_HORUS_PATH", ...snapshot()};
    if (typeof fetchObservation !== "function") return {applied: false, reason: "FETCH_UNAVAILABLE", ...snapshot()};

    controller = new AbortController();
    const requestController = controller;
    let result;
    try {
      result = await fetchObservation({asset: assetId, signal: requestController.signal});
    } catch {
      result = unavailable("NETWORK_ERROR");
    }
    if (token !== requestToken || assetId !== nextAssetId || controller !== requestController) {
      return {applied: false, reason: "STALE_SELECTION", ...snapshot()};
    }
    controller = null;
    if (!canReadAsset(assetId)) return {applied: false, reason: "LOCKED", ...snapshot()};
    observation = result;
    publish();
    return {applied: true, ...snapshot()};
  }

  function reconcileAccess() {
    if (canReadAsset(assetId)) return snapshot();
    controller?.abort();
    controller = null;
    observation = null;
    requestToken += 1;
    publish();
    return snapshot();
  }

  return Object.freeze({select, snapshot, reconcileAccess});
}
