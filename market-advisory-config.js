"use strict";

// A null advisory is intentional: do not surface an alert without a supported LIVE source.
window.AiLynxAdvisoryConfig = Object.freeze({
  active: null,
  taxonomy: Object.freeze(["RISK", "VOLATILITY", "LIQUIDITY", "EVENT"]),
  evidencePlan: "PRO",
});
