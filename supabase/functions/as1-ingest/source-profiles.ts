import {ValidationError} from "./validation-error.ts";

type JsonRecord = Record<string, unknown>;

type SourceProfile = {
  sourceProfileCode: string;
  allowedLayouts: readonly string[];
  instrument: Readonly<Record<string, string | null | boolean>>;
  contract: Readonly<Record<string, string | null | boolean>>;
  session: Readonly<Record<string, string>>;
  volumeUnit: string;
  volumeBasis: string;
};

// Runtime mirror of the public AS1 source-profile registry.  Keep this small,
// explicit allowlist in the Edge function: packets must never self-declare a
// new source identity merely by choosing a profile-code string.
const COMMON_UNKNOWN_CFD_CONTRACT = {
  contract_type: "UNKNOWN",
  contract_id: null,
  series_symbol: null,
  expiry_kind: "UNKNOWN",
  expiry_time: null,
  settlement_asset: "USD",
  contract_multiplier: null,
  continuous_series: false,
  adjustment_mode: "UNKNOWN",
  adjustment_applied: false,
  roll_state: "UNKNOWN",
  roll_event: false,
} as const;

// TradingView CRYPTOCAP dominance symbols are derived percentage series, not
// spot markets or derivative contracts. They have no settlement contract and
// do not expose trade-volume semantics suitable for AS1 comparison.
const COMMON_DOMINANCE_INDEX_CONTRACT = {
  contract_type: "NONE",
  contract_id: null,
  series_symbol: null,
  expiry_kind: "NONE",
  expiry_time: null,
  settlement_asset: null,
  contract_multiplier: null,
  continuous_series: false,
  adjustment_mode: "NONE",
  adjustment_applied: false,
  roll_state: "NONE",
  roll_event: false,
} as const;

const SOURCE_PROFILES: readonly SourceProfile[] = [
  {
    sourceProfileCode: "CB_BTCUSD_SPOT_20260722_V1",
    allowedLayouts: ["HORUS_A", "HORUS_B", "MAAT", "MAAT2"],
    instrument: {ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD", base_asset: "BTC", quote_asset: "USD", asset_class: "CRYPTO", instrument_type: "SPOT"},
    contract: {contract_type: "NONE", contract_id: null, series_symbol: null, expiry_kind: "NONE", expiry_time: null, settlement_asset: "USD", contract_multiplier: null, continuous_series: false, adjustment_mode: "NONE", adjustment_applied: false, roll_state: "NONE", roll_event: false},
    session: {session_type: "CONTINUOUS_24_7", session_state: "OPEN"},
    volumeUnit: "BASE_ASSET",
    volumeBasis: "EXCHANGE_NATIVE",
  },
  {
    sourceProfileCode: "OANDA_XAUUSD_CFD_V1",
    allowedLayouts: ["HORUS_A"],
    instrument: {ticker_id: "OANDA:XAUUSD", venue: "OANDA", symbol: "XAUUSD", base_asset: "XAU", quote_asset: "USD", asset_class: "COMMODITY", instrument_type: "CFD"},
    contract: COMMON_UNKNOWN_CFD_CONTRACT,
    session: {session_type: "UNKNOWN", session_state: "UNKNOWN"},
    volumeUnit: "UNKNOWN",
    volumeBasis: "UNKNOWN",
  },
  {
    sourceProfileCode: "CAPITALCOM_DXY_CFD_V1",
    allowedLayouts: ["HORUS_A"],
    instrument: {ticker_id: "CAPITALCOM:DXY", venue: "CAPITALCOM", symbol: "DXY", base_asset: "UNKNOWN", quote_asset: "USD", asset_class: "INDEX", instrument_type: "CFD"},
    contract: COMMON_UNKNOWN_CFD_CONTRACT,
    session: {session_type: "UNKNOWN", session_state: "UNKNOWN"},
    volumeUnit: "UNKNOWN",
    volumeBasis: "UNKNOWN",
  },
  {
    sourceProfileCode: "SKILLING_US100_CFD_V1",
    allowedLayouts: ["HORUS_A"],
    instrument: {ticker_id: "SKILLING:US100", venue: "SKILLING", symbol: "US100", base_asset: "UNKNOWN", quote_asset: "USD", asset_class: "INDEX", instrument_type: "CFD"},
    contract: COMMON_UNKNOWN_CFD_CONTRACT,
    session: {session_type: "UNKNOWN", session_state: "UNKNOWN"},
    volumeUnit: "UNKNOWN",
    volumeBasis: "UNKNOWN",
  },
  {
    sourceProfileCode: "CRYPTOCAP_BTC_D_DOMINANCE_V1",
    allowedLayouts: ["HORUS_A"],
    instrument: {ticker_id: "CRYPTOCAP:BTC.D", venue: "CRYPTOCAP", symbol: "BTC.D", base_asset: "BTC", quote_asset: "UNKNOWN", asset_class: "CRYPTO", instrument_type: "INDEX"},
    contract: COMMON_DOMINANCE_INDEX_CONTRACT,
    session: {session_type: "UNKNOWN", session_state: "UNKNOWN"},
    volumeUnit: "UNKNOWN",
    volumeBasis: "UNKNOWN",
  },
  {
    sourceProfileCode: "CRYPTOCAP_USDT_D_DOMINANCE_V1",
    allowedLayouts: ["HORUS_A"],
    instrument: {ticker_id: "CRYPTOCAP:USDT.D", venue: "CRYPTOCAP", symbol: "USDT.D", base_asset: "USDT", quote_asset: "UNKNOWN", asset_class: "CRYPTO", instrument_type: "INDEX"},
    contract: COMMON_DOMINANCE_INDEX_CONTRACT,
    session: {session_type: "UNKNOWN", session_state: "UNKNOWN"},
    volumeUnit: "UNKNOWN",
    volumeBasis: "UNKNOWN",
  },
  {
    sourceProfileCode: "CRYPTOCAP_USDC_D_DOMINANCE_V1",
    allowedLayouts: ["HORUS_A"],
    instrument: {ticker_id: "CRYPTOCAP:USDC.D", venue: "CRYPTOCAP", symbol: "USDC.D", base_asset: "USDC", quote_asset: "UNKNOWN", asset_class: "CRYPTO", instrument_type: "INDEX"},
    contract: COMMON_DOMINANCE_INDEX_CONTRACT,
    session: {session_type: "UNKNOWN", session_state: "UNKNOWN"},
    volumeUnit: "UNKNOWN",
    volumeBasis: "UNKNOWN",
  },
];

function requireRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ValidationError(`${context} must be an object`);
  return value as JsonRecord;
}

function assertExactFields(actual: JsonRecord, expected: Readonly<Record<string, string | null | boolean>>, context: string): void {
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.hasOwn(actual, key) || actual[key] !== value) {
      throw new ValidationError(`SOURCE_PROFILE_MISMATCH: ${context}.${key}`);
    }
  }
}

export function validateSourceProfile(envelope: JsonRecord, sourceProfileCode: string, layoutId: string): void {
  const profile = SOURCE_PROFILES.find((candidate) => candidate.sourceProfileCode === sourceProfileCode);
  if (!profile) throw new ValidationError("UNKNOWN_SOURCE_PROFILE");
  if (!profile.allowedLayouts.includes(layoutId)) throw new ValidationError("SOURCE_PROFILE_MISMATCH: layout_id");

  assertExactFields(requireRecord(envelope.instrument, "instrument"), profile.instrument, "instrument");
  assertExactFields(requireRecord(envelope.instrument && (envelope.instrument as JsonRecord).contract, "instrument.contract"), profile.contract, "instrument.contract");
  assertExactFields(requireRecord(envelope.session_hint, "session_hint"), profile.session, "session_hint");

  const bar = requireRecord(envelope.bar, "bar");
  if (bar.volume_unit !== profile.volumeUnit) throw new ValidationError("SOURCE_PROFILE_MISMATCH: bar.volume_unit");
  if (bar.volume_basis !== profile.volumeBasis) throw new ValidationError("SOURCE_PROFILE_MISMATCH: bar.volume_basis");
}
