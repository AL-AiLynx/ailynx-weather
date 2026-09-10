import {ASSET_READERS} from "./asset-registry.js";

const formats = Object.freeze({
  USD_0: {style: "currency", currency: "USD", maximumFractionDigits: 0},
  USD_2: {style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2},
  NUMBER_0: {style: "decimal", maximumFractionDigits: 0},
  NUMBER_2: {style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2},
});

export function formatAssetPrice(value, assetId = "BTCUSD") {
  if (!Number.isFinite(value) || value <= 0) return "데이터 대기";
  const format = ASSET_READERS[assetId]?.priceFormat || "USD_0";
  return new Intl.NumberFormat("en-US", formats[format] || formats.USD_0).format(value);
}

export function assetPriceUnit(assetId) {
  return ASSET_READERS[assetId]?.priceUnit || null;
}

if (typeof window !== "undefined") window.AiLynxAssetPresentation = Object.freeze({formatAssetPrice, assetPriceUnit});
