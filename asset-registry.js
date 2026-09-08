"use strict";

// Single browser registry for the four main Weather assets. Server projection
// maintains the same fixed allow-list and never accepts arbitrary tickers.
export const ASSET_READERS = Object.freeze({
  BTCUSD: Object.freeze({id: "BTCUSD", label: "BTCUSD", tickerId: "COINBASE:BTCUSD", sourceProfileCode: "CB_BTCUSD_SPOT_20260722_V1", requiredPlan: "FREE", priceKind: "CURRENT"}),
  XAUUSD: Object.freeze({id: "XAUUSD", label: "GOLD", tickerId: "OANDA:XAUUSD", sourceProfileCode: "OANDA_XAUUSD_CFD_V1", requiredPlan: "PLUS", priceKind: "OBSERVED"}),
  DXY: Object.freeze({id: "DXY", label: "DXY", tickerId: "CAPITALCOM:DXY", sourceProfileCode: "CAPITALCOM_DXY_CFD_V1", requiredPlan: "PREMIUM", priceKind: "OBSERVED"}),
  US100: Object.freeze({id: "US100", label: "NASDAQ", tickerId: "SKILLING:US100", sourceProfileCode: "SKILLING_US100_CFD_V1", requiredPlan: "PLUS", priceKind: "OBSERVED"}),
});
const assets = Object.freeze(Object.values(ASSET_READERS));
if (typeof window !== "undefined") window.AiLynxAssetRegistry = Object.freeze({assets, byId: (id) => ASSET_READERS[id] ?? null});
