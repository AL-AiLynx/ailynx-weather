import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {ValidationError, validateEnvelope} from "../../as1-ingest/validate-envelope.ts";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../../satellites/AS1-tradingview/pipeline/examples/", import.meta.url));
function example(name: string): any { return JSON.parse(readFileSync(`${EXAMPLE_DIR}${name}`, "utf8")); }
const V13_FIXTURE = fileURLToPath(new URL("../../../../satellites/AS1-tradingview/pipeline/tests/fixtures/v1.3/AS1_V13_NORMAL_001.json", import.meta.url));
const SOURCE_PROFILE_REGISTRY = fileURLToPath(new URL("../../../../satellites/AS1-tradingview/pipeline/config/source-profile-registry-v1.3.json", import.meta.url));

const V14_CASES = [
  ["maat-validation-envelope-v1.4.json", "VALIDATION_SNAPSHOT"],
  ["maat2-hub-state-envelope-v1.4.json", "HUB_STATE_SNAPSHOT"],
  ["maat2-time-engine-envelope-v1.4.json", "TIME_ENGINE_SNAPSHOT"],
] as const;

const CFD_PROFILES = [
  {code: "OANDA_XAUUSD_CFD_V1", ticker: "OANDA:XAUUSD", venue: "OANDA", symbol: "XAUUSD", base: "XAU", assetClass: "COMMODITY"},
  {code: "CAPITALCOM_DXY_CFD_V1", ticker: "CAPITALCOM:DXY", venue: "CAPITALCOM", symbol: "DXY", base: "UNKNOWN", assetClass: "INDEX"},
  {code: "SKILLING_US100_CFD_V1", ticker: "SKILLING:US100", venue: "SKILLING", symbol: "US100", base: "UNKNOWN", assetClass: "INDEX"},
] as const;

const DOMINANCE_PROFILES = [
  {code: "CRYPTOCAP_BTC_D_DOMINANCE_V1", ticker: "CRYPTOCAP:BTC.D", symbol: "BTC.D", base: "BTC"},
  {code: "CRYPTOCAP_USDT_D_DOMINANCE_V1", ticker: "CRYPTOCAP:USDT.D", symbol: "USDT.D", base: "USDT"},
  {code: "CRYPTOCAP_USDC_D_DOMINANCE_V1", ticker: "CRYPTOCAP:USDC.D", symbol: "USDC.D", base: "USDC"},
] as const;

function v13Event(): any {
  return JSON.parse(readFileSync(V13_FIXTURE, "utf8")).raw_events[0];
}

function withCfdProfile(profile: (typeof CFD_PROFILES)[number]): any {
  const event = v13Event();
  event.source_profile_code = profile.code;
  event.instrument = {
    ticker_id: profile.ticker,
    venue: profile.venue,
    symbol: profile.symbol,
    base_asset: profile.base,
    quote_asset: "USD",
    asset_class: profile.assetClass,
    instrument_type: "CFD",
    contract: {
      contract_type: "UNKNOWN", contract_id: null, series_symbol: null, expiry_kind: "UNKNOWN", expiry_time: null,
      settlement_asset: "USD", contract_multiplier: null, continuous_series: false, adjustment_mode: "UNKNOWN",
      adjustment_applied: false, roll_state: "UNKNOWN", roll_event: false,
    },
  };
  event.session_hint = {session_type: "UNKNOWN", session_state: "UNKNOWN", is_market_open: true};
  event.bar.volume_unit = "UNKNOWN";
  event.bar.volume_basis = "UNKNOWN";
  event.client_event_key = ["AS1", "HORUS_A", profile.ticker, event.timing.timeframe, String(event.timing.bar_close_time), "as1.v1.3"].join("|");
  return event;
}

function withDominanceProfile(profile: (typeof DOMINANCE_PROFILES)[number]): any {
  const event = v13Event();
  event.source_profile_code = profile.code;
  event.instrument = {
    ticker_id: profile.ticker,
    venue: "CRYPTOCAP",
    symbol: profile.symbol,
    base_asset: profile.base,
    quote_asset: "UNKNOWN",
    asset_class: "CRYPTO",
    instrument_type: "INDEX",
    contract: {
      contract_type: "NONE", contract_id: null, series_symbol: null, expiry_kind: "NONE", expiry_time: null,
      settlement_asset: null, contract_multiplier: null, continuous_series: false, adjustment_mode: "NONE",
      adjustment_applied: false, roll_state: "NONE", roll_event: false,
    },
  };
  event.session_hint = {session_type: "UNKNOWN", session_state: "UNKNOWN", is_market_open: false};
  event.bar.volume = null;
  event.bar.volume_unit = "UNKNOWN";
  event.bar.volume_basis = "UNKNOWN";
  event.quality.sensor_quality = "LIMITED";
  event.quality.valid = true;
  event.quality.flags = ["MISSING_VOLUME"];
  event.client_event_key = ["AS1", "HORUS_A", profile.ticker, event.timing.timeframe, String(event.timing.bar_close_time), "as1.v1.3"].join("|");
  return event;
}

test("1. accepts all three AS1 v1.4 packet identities", () => {
  for (const [filename, packetType] of V14_CASES) {
    const row = validateEnvelope(example(filename));
    assert.equal(row.schema_version, "as1.v1.4");
    assert.equal(row.packet_type, packetType);
  }
});

test("2. preserves AS1 v1.3 acceptance and legacy key", () => {
  const event = v13Event();
  const row = validateEnvelope(event);
  assert.equal(row.schema_version, "as1.v1.3");
  assert.equal(row.packet_type, "BAR_CLOSE_SNAPSHOT");
});

test("2a. accepts each explicit active multi-asset source profile", () => {
  for (const profile of CFD_PROFILES) {
    const row = validateEnvelope(withCfdProfile(profile));
    assert.equal(row.source_profile_code, profile.code);
    assert.equal(row.ticker_id, profile.ticker);
    assert.equal(row.valid, true);
  }
});

test("2b. rejects cross-profile source identities without changing event-key semantics", () => {
  const xauWithBtcProfile = withCfdProfile(CFD_PROFILES[0]);
  xauWithBtcProfile.source_profile_code = "CB_BTCUSD_SPOT_20260722_V1";
  assert.throws(() => validateEnvelope(xauWithBtcProfile), /SOURCE_PROFILE_MISMATCH/);

  const dxyWithUs100Profile = withCfdProfile(CFD_PROFILES[1]);
  dxyWithUs100Profile.source_profile_code = "SKILLING_US100_CFD_V1";
  assert.throws(() => validateEnvelope(dxyWithUs100Profile), /SOURCE_PROFILE_MISMATCH/);

  const event = withCfdProfile(CFD_PROFILES[2]);
  const expectedKey = event.client_event_key;
  const row = validateEnvelope(event);
  assert.equal(row.client_event_key, expectedKey);
});

test("2c. accepts the three explicit CRYPTOCAP dominance profiles as derived percentage indexes", () => {
  for (const profile of DOMINANCE_PROFILES) {
    const row = validateEnvelope(withDominanceProfile(profile));
    assert.equal(row.source_profile_code, profile.code);
    assert.equal(row.ticker_id, profile.ticker);
    assert.equal(row.valid, true);
    assert.equal(row.sensor_quality, "LIMITED");
    assert.deepEqual(row.flags, ["MISSING_VOLUME"]);
  }
});

test("2d. rejects wrong dominance ticker, venue, profile, and spot semantics", () => {
  const wrongTicker = withDominanceProfile(DOMINANCE_PROFILES[0]);
  wrongTicker.instrument.ticker_id = "CRYPTOCAP:USDT.D";
  assert.throws(() => validateEnvelope(wrongTicker), /SOURCE_PROFILE_MISMATCH: instrument.ticker_id/);

  const wrongVenue = withDominanceProfile(DOMINANCE_PROFILES[1]);
  wrongVenue.instrument.venue = "COINBASE";
  assert.throws(() => validateEnvelope(wrongVenue), /SOURCE_PROFILE_MISMATCH: instrument.venue/);

  const wrongProfile = withDominanceProfile(DOMINANCE_PROFILES[2]);
  wrongProfile.source_profile_code = "CB_BTCUSD_SPOT_20260722_V1";
  assert.throws(() => validateEnvelope(wrongProfile), /SOURCE_PROFILE_MISMATCH/);

  const wrongContract = withDominanceProfile(DOMINANCE_PROFILES[0]);
  wrongContract.instrument.contract.contract_type = "SPOT";
  assert.throws(() => validateEnvelope(wrongContract), /SOURCE_PROFILE_MISMATCH: instrument.contract.contract_type/);
});

test("2e. checked-in source-profile registry matches the seven runtime identities", () => {
  const registry = JSON.parse(readFileSync(SOURCE_PROFILE_REGISTRY, "utf8"));
  const profiles = new Map(registry.profiles.map((profile: any) => [profile.source_profile_code, profile]));
  const expected = [
    ["CB_BTCUSD_SPOT_20260722_V1", "COINBASE:BTCUSD", "COINBASE", "BTCUSD", "SPOT"],
    ...CFD_PROFILES.map((profile) => [profile.code, profile.ticker, profile.venue, profile.symbol, "CFD"]),
    ...DOMINANCE_PROFILES.map((profile) => [profile.code, profile.ticker, "CRYPTOCAP", profile.symbol, "INDEX"]),
  ];
  for (const [code, ticker, venue, symbol, instrumentType] of expected) {
    const profile: any = profiles.get(code);
    assert.ok(profile, code);
    assert.equal(profile.ticker_id, ticker);
    assert.equal(profile.venue, venue);
    assert.equal(profile.symbol, symbol);
    assert.equal(profile.instrument_type, instrumentType);
    assert.deepEqual(profile.allowed_layouts, code === "CB_BTCUSD_SPOT_20260722_V1"
      ? ["HORUS_A", "HORUS_B", "MAAT", "MAAT2"]
      : ["HORUS_A"]);
  }
});

test("3. packet_type keeps same-bar Hub and Time keys distinct", () => {
  const hub = validateEnvelope(example("maat2-hub-state-envelope-v1.4.json"));
  const time = validateEnvelope(example("maat2-time-engine-envelope-v1.4.json"));
  assert.equal(hub.bar_close_time, time.bar_close_time);
  assert.notEqual(hub.client_event_key, time.client_event_key);
});

test("4. rejects a mismatched v1.4 matrix or client key", () => {
  const hub = example("maat2-hub-state-envelope-v1.4.json");
  hub.observer = "MAAT2_TIME";
  assert.throws(() => validateEnvelope(hub), ValidationError);
  const maat = example("maat-validation-envelope-v1.4.json");
  maat.client_event_key = maat.client_event_key.replace("VALIDATION_SNAPSHOT", "TIME_ENGINE_SNAPSHOT");
  assert.throws(() => validateEnvelope(maat), ValidationError);
});

test("5. rejects prediction and automatic HIT/MISS mutations", () => {
  const maat = example("maat-validation-envelope-v1.4.json");
  maat.payload.automatic_hit_miss = "HIT";
  assert.throws(() => validateEnvelope(maat), ValidationError);
  const time = example("maat2-time-engine-envelope-v1.4.json");
  time.payload.prediction_direction = "UP";
  assert.throws(() => validateEnvelope(time), ValidationError);
  const hub = example("maat2-hub-state-envelope-v1.4.json");
  hub.payload.hit_miss = "MISS";
  assert.throws(() => validateEnvelope(hub), ValidationError);
});

test("6. rejects unknown top-level or payload fields in v1.4", () => {
  const event = example("maat-validation-envelope-v1.4.json");
  event.webhook_token = "must-never-be-in-body";
  assert.throws(() => validateEnvelope(event), ValidationError);
  delete event.webhook_token;
  event.payload.prediction = "UP";
  assert.throws(() => validateEnvelope(event), ValidationError);
});

test("7. rejects schema-invalid nested values before they reach the read projection", () => {
  const maat = example("maat-validation-envelope-v1.4.json");
  maat.payload.stopwatch.target_time = null;
  assert.throws(() => validateEnvelope(maat), ValidationError);

  const hub = example("maat2-hub-state-envelope-v1.4.json");
  hub.payload.guards.mask = 16;
  assert.throws(() => validateEnvelope(hub), ValidationError);

  const time = example("maat2-time-engine-envelope-v1.4.json");
  time.payload.time.window_flag = "false";
  assert.throws(() => validateEnvelope(time), ValidationError);
});

test("8. rejects the observed Time score overflow and accepts its invalid-bridge neutral projection", () => {
  for (const [score, value] of [["window", 122], ["risk", 112]] as const) {
    const overflow = example("maat2-time-engine-envelope-v1.4.json");
    overflow.payload.scores[score] = value;
    assert.throws(() => validateEnvelope(overflow), new RegExp(`${score} is above maximum`));
  }

  const projected = example("maat2-time-engine-envelope-v1.4.json");
  projected.quality = {
    sensor_quality: "INVALID",
    valid: false,
    flags: ["HERU_EXTERNAL_ONLY", "BRIDGE_INVALID", "BRIDGE_STATE_PACKET_INVALID", "BRIDGE_METRICS_PACKET_INVALID", "BRIDGE_DIAG_3"],
  };
  projected.payload.record_status = "WATCH";
  projected.payload.scores = {structure: 0, force: 0, window: 0, risk: 0};
  projected.payload.hub = {phase_code: 0, result_code: 0, core_state_code: 3, peripheral_state_code: 3};
  Object.assign(projected.payload.time, {
    score: 0,
    state_code: 0,
    role_code: 9,
    result_code: 0,
    why_code: 82,
    noise_score: 0,
    window_flag: false,
    reset_flag: false,
    valid: false,
    guard_mask: 0,
    alert_mask: 0,
    diag_code: 3,
  });

  const row = validateEnvelope(projected);
  assert.equal(row.valid, false);
  assert.equal(row.packet_type, "TIME_ENGINE_SNAPSHOT");
});
