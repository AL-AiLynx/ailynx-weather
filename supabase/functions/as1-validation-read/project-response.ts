export const API_SCHEMA_VERSION = "as1-validation-read.v1";

export const SOURCE_IDENTITY = Object.freeze({
  schema_version: "as1.v1.4",
  satellite_id: "AS1",
  platform: "TRADINGVIEW",
  source_profile_code: "CB_BTCUSD_SPOT_20260722_V1",
  ticker_id: "COINBASE:BTCUSD",
  venue: "COINBASE",
  symbol: "BTCUSD",
});

export const VIEW_CONFIGS = Object.freeze({
  MAAT: Object.freeze({
    layout_id: "MAAT",
    observer: "MAAT",
    code_version: "MAAT_STOPWATCH_AS1_V1_4",
    packet_type: "VALIDATION_SNAPSHOT",
  }),
  MAAT2_HUB: Object.freeze({
    layout_id: "MAAT2",
    observer: "MAAT2_HUB",
    code_version: "MAAT2_HUB_V1_1_AS1_V1_4",
    packet_type: "HUB_STATE_SNAPSHOT",
  }),
  MAAT2_TIME: Object.freeze({
    layout_id: "MAAT2",
    observer: "MAAT2_TIME",
    code_version: "MAAT2_TIME_V1_AS1_V1_4",
    packet_type: "TIME_ENGINE_SNAPSHOT",
  }),
});

export const TIMEFRAME_CADENCE_SECONDS = Object.freeze({
  "240": 14_400,
  "480": 28_800,
  "720": 43_200,
  "D": 86_400,
  "1D": 86_400,
  "1440": 86_400,
});

export type ViewId = keyof typeof VIEW_CONFIGS;
export type TimeframeId = keyof typeof TIMEFRAME_CADENCE_SECONDS;
export type Selection = Readonly<{ view: ViewId; timeframe: TimeframeId }>;
type JsonRecord = Record<string, unknown>;

const SENSOR_KEYS = ["rpc", "structure", "volume", "heru", "wenut", "rsi"] as const;
const QUALITY = new Set(["GOOD", "LIMITED", "WATCH", "INVALID"]);
const INVALID_FUTURE_MS = 5 * 60 * 1000;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export class ProjectionError extends Error {
  readonly code = "INVALID_OBSERVATION";

  constructor() {
    super("Observation failed validation projection");
    this.name = "ProjectionError";
  }
}

function invalid(): never {
  throw new ProjectionError();
}

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as JsonRecord;
}

function stringValue(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function enumString(value: unknown, allowed: readonly string[] | Set<string>): string {
  const result = stringValue(value);
  if (!(allowed instanceof Set ? allowed.has(result) : allowed.includes(result))) invalid();
  return result;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function numberValue(value: unknown, minimum?: number, maximum?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  if (minimum !== undefined && value < minimum) invalid();
  if (maximum !== undefined && value > maximum) invalid();
  return value;
}

function integerValue(value: unknown, minimum?: number, maximum?: number): number {
  const result = numberValue(value, minimum, maximum);
  if (!Number.isSafeInteger(result)) invalid();
  return result;
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integerValue(value, 0);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) invalid();
  if (new Set(value).size !== value.length) invalid();
  return [...value];
}

function isoTimestamp(value: unknown): { iso: string; milliseconds: number } {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) invalid();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) invalid();
  return { iso: new Date(milliseconds).toISOString(), milliseconds };
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) invalid();
}

function scoreSet(value: unknown) {
  const scores = record(value);
  return {
    structure: numberValue(scores.structure, 0, 100),
    force: numberValue(scores.force, 0, 100),
    window: numberValue(scores.window, 0, 100),
    risk: numberValue(scores.risk, 0, 100),
  };
}

function projectSensor(value: unknown) {
  const sensor = record(value);
  return {
    linked: booleanValue(sensor.linked),
    valid: booleanValue(sensor.valid),
    direction_state_code: integerValue(sensor.direction_state_code, -1, 1),
    score: numberValue(sensor.score, 0, 100),
    risk_code: integerValue(sensor.risk_code, 0, 5),
    event_code: integerValue(sensor.event_code, 0, 9),
  };
}

function projectMaatPayload(value: unknown) {
  const payload = record(value);
  assertEqual(payload.contract_version, "maat.validation.v1");
  assertEqual(payload.validation_outcome, "PENDING");
  assertEqual(payload.automatic_hit_miss, "SUPPRESSED");
  const aggregate = record(payload.aggregate);
  const sensors = record(payload.sensors);
  const stopwatch = record(payload.stopwatch);

  const projectedSensors: Record<string, ReturnType<typeof projectSensor>> = {};
  for (const key of SENSOR_KEYS) projectedSensors[key] = projectSensor(sensors[key]);

  return {
    contract_version: "maat.validation.v1",
    record_status: enumString(payload.record_status, ["OFF", "WATCH", "WINDOW_OPEN", "EVENT_OBSERVED", "RESET"]),
    validation_outcome: "PENDING",
    automatic_hit_miss: "SUPPRESSED",
    aggregate: {
      state_code: integerValue(aggregate.state_code, 0, 6),
      score: numberValue(aggregate.score, 0, 100),
      risk_code: integerValue(aggregate.risk_code, 0, 5),
      event_code: integerValue(aggregate.event_code, 0, 9),
      sync_count: integerValue(aggregate.sync_count, 0, 6),
      conflict_count: integerValue(aggregate.conflict_count, 0, 6),
      lie_score: numberValue(aggregate.lie_score, 0, 100),
      lie_code: integerValue(aggregate.lie_code, 0, 3),
      why_code: integerValue(aggregate.why_code, 0, 9),
      direction_state_code: integerValue(aggregate.direction_state_code, -1, 1),
      direction_semantics: enumString(aggregate.direction_semantics, ["OBSERVED_SENSOR_STATE_NOT_PREDICTION"]),
    },
    sensors: projectedSensors,
    stopwatch: {
      phase: stringValue(stopwatch.phase),
      main_tf_minutes: integerValue(stopwatch.main_tf_minutes, 1),
      parent_tf_minutes: integerValue(stopwatch.parent_tf_minutes, 1),
      target_time: integerValue(stopwatch.target_time, 0),
      window_start: integerValue(stopwatch.window_start, 0),
      window_end: integerValue(stopwatch.window_end, 0),
      remaining_minutes: numberValue(stopwatch.remaining_minutes, 0),
      in_window: booleanValue(stopwatch.in_window),
      noise_score: integerValue(stopwatch.noise_score, 0, 100),
      volume_event_observed: booleanValue(stopwatch.volume_event_observed),
      volume_type: stringValue(stopwatch.volume_type),
      rvol: numberValue(stopwatch.rvol, 0),
    },
  };
}

function guardState(value: unknown) {
  const state = record(value);
  return {
    mask: integerValue(state.mask, 0, 15),
    window: booleanValue(state.window),
    force: booleanValue(state.force),
    noise: booleanValue(state.noise),
    reset: booleanValue(state.reset),
  };
}

function alertState(value: unknown) {
  const state = record(value);
  return {
    mask: integerValue(state.mask, 0, 15),
    window_open: booleanValue(state.window_open),
    force_event: booleanValue(state.force_event),
    noise_only: booleanValue(state.noise_only),
    reset_required: booleanValue(state.reset_required),
  };
}

function projectHubPayload(value: unknown) {
  const payload = record(value);
  assertEqual(payload.contract_version, "maat2.hub.v1");
  assertEqual(payload.validation_outcome, "PENDING");
  const phase = record(payload.phase);
  const sources = record(payload.sources);
  const diagnostics = record(payload.diagnostics);
  assertEqual(sources.heru_mode, "EXTERNAL_ONLY");

  return {
    contract_version: "maat2.hub.v1",
    record_status: enumString(payload.record_status, ["WATCH", "WINDOW_OPEN", "FORCE_EVENT", "NOISE_ONLY", "RESET"]),
    validation_outcome: "PENDING",
    scores: scoreSet(payload.scores),
    phase: {
      raw_code: integerValue(phase.raw_code, 0, 11),
      candidate_result_code: integerValue(phase.candidate_result_code, 0, 4),
      final_result_code: integerValue(phase.final_result_code, 0, 4),
    },
    guards: guardState(payload.guards),
    alerts: alertState(payload.alerts),
    sources: {
      was_valid: booleanValue(sources.was_valid),
      true_vol_valid: booleanValue(sources.true_vol_valid),
      expansion_state_code: integerValue(sources.expansion_state_code, 0, 3),
      peripheral_state_code: integerValue(sources.peripheral_state_code, 0, 3),
      system_partial: booleanValue(sources.system_partial),
      system_invalid: booleanValue(sources.system_invalid),
      heru_mode: "EXTERNAL_ONLY",
    },
    diagnostics: {
      note_code: integerValue(diagnostics.note_code, 0),
      layer_note_code: integerValue(diagnostics.layer_note_code, 0),
      filter_note_code: integerValue(diagnostics.filter_note_code, 0),
      background_support: booleanValue(diagnostics.background_support),
      risk_block: booleanValue(diagnostics.risk_block),
      bridge_valid: booleanValue(diagnostics.bridge_valid),
    },
  };
}

function projectTimePayload(value: unknown) {
  const payload = record(value);
  assertEqual(payload.contract_version, "maat2.time.v1");
  assertEqual(payload.validation_outcome, "PENDING");
  assertEqual(payload.automatic_hit_miss, "NOT_IMPLEMENTED");
  assertEqual(payload.prediction_direction, "NOT_PROVIDED");
  const hub = record(payload.hub);
  const time = record(payload.time);

  return {
    contract_version: "maat2.time.v1",
    record_status: enumString(payload.record_status, ["WATCH", "PRE_WINDOW", "WINDOW_CANDIDATE", "WINDOW_OPEN", "FORCE_EXPRESSION_CANDIDATE", "NOISE_ONLY", "FALSE_RELEASE", "RESET_REQUIRED"]),
    validation_outcome: "PENDING",
    automatic_hit_miss: "NOT_IMPLEMENTED",
    prediction_direction: "NOT_PROVIDED",
    scores: scoreSet(payload.scores),
    hub: {
      phase_code: integerValue(hub.phase_code, 0, 11),
      result_code: integerValue(hub.result_code, 0, 9),
      core_state_code: integerValue(hub.core_state_code, 0, 3),
      peripheral_state_code: integerValue(hub.peripheral_state_code, 0, 3),
    },
    time: {
      score: integerValue(time.score, 0, 100),
      state_code: integerValue(time.state_code, 0, 9),
      role_code: integerValue(time.role_code, 0, 9),
      result_code: integerValue(time.result_code, 0, 7),
      why_code: integerValue(time.why_code, 0, 99),
      noise_score: integerValue(time.noise_score, 0, 100),
      candidate_tf_minutes: integerValue(time.candidate_tf_minutes, 0),
      parent_tf_minutes: integerValue(time.parent_tf_minutes, 0),
      parent_distance_minutes: integerValue(time.parent_distance_minutes, 0),
      window_flag: booleanValue(time.window_flag),
      reset_flag: booleanValue(time.reset_flag),
      valid: booleanValue(time.valid),
      guard_mask: integerValue(time.guard_mask, 0, 15),
      alert_mask: integerValue(time.alert_mask, 0, 15),
      bars_in_state: integerValue(time.bars_in_state, 0),
      state_change_count: numberValue(time.state_change_count, 0),
      diag_code: integerValue(time.diag_code, 0),
      expected_window_start: nullableInteger(time.expected_window_start),
      expected_window_end: nullableInteger(time.expected_window_end),
    },
  };
}

export function resolveSelection(urlValue: string): Selection | null {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }
  const view = url.searchParams.get("view") as ViewId | null;
  const timeframe = url.searchParams.get("timeframe") as TimeframeId | null;
  if (!view || !Object.hasOwn(VIEW_CONFIGS, view) || !timeframe || !Object.hasOwn(TIMEFRAME_CADENCE_SECONDS, timeframe)) return null;
  if ([...url.searchParams.keys()].some((key) => key !== "view" && key !== "timeframe")) return null;
  return Object.freeze({ view, timeframe });
}

export function computeFreshness(receivedAtMs: number, nowMs: number, cadenceSeconds: number) {
  if (!Number.isFinite(receivedAtMs) || !Number.isFinite(nowMs) || !Number.isFinite(cadenceSeconds) || cadenceSeconds <= 0) invalid();
  const ageMs = nowMs - receivedAtMs;
  const cadenceMs = cadenceSeconds * 1000;
  const state = ageMs <= -INVALID_FUTURE_MS
    ? "INVALID_CLOCK"
    : ageMs <= cadenceMs * 1.125
    ? "FRESH"
    : ageMs <= cadenceMs * 2.125
    ? "AGING"
    : ageMs <= cadenceMs * 6
    ? "STALE"
    : "EXPIRED";
  return { state, age_seconds: Math.max(0, Math.floor(ageMs / 1000)), cadence_seconds: cadenceSeconds };
}

export function projectValidationResponse(rowValue: unknown, selection: Selection, now = new Date()) {
  const row = record(rowValue);
  const config = VIEW_CONFIGS[selection.view];
  for (const [key, expected] of Object.entries(SOURCE_IDENTITY)) assertEqual(row[key], expected);
  for (const [key, expected] of Object.entries(config)) assertEqual(row[key], expected);
  assertEqual(row.timeframe, selection.timeframe);
  assertEqual(row.confirmed, true);

  const qualityValue = enumString(row.sensor_quality, QUALITY);
  const validValue = booleanValue(row.valid);
  const flags = stringArray(row.flags);
  const barOpenTime = integerValue(row.bar_open_time, 1);
  const barCloseTime = integerValue(row.bar_close_time, 1);
  if (barOpenTime >= barCloseTime) invalid();
  const receivedAt = isoTimestamp(row.received_at);
  const rawEnvelope = record(row.raw_envelope);
  const rawInstrument = record(rawEnvelope.instrument);
  const rawTiming = record(rawEnvelope.timing);
  const rawBar = record(rawEnvelope.bar);
  const rawQuality = record(rawEnvelope.quality);

  for (const key of ["schema_version", "satellite_id", "platform", "layout_id", "observer", "code_version", "source_profile_code", "packet_type", "confirmed"]) assertEqual(rawEnvelope[key], row[key]);
  assertEqual(rawInstrument.ticker_id, row.ticker_id);
  assertEqual(rawInstrument.venue, row.venue);
  assertEqual(rawInstrument.symbol, row.symbol);
  assertEqual(rawTiming.timeframe, selection.timeframe);
  assertEqual(rawTiming.bar_open_time, barOpenTime);
  assertEqual(rawTiming.bar_close_time, barCloseTime);
  assertEqual(rawQuality.sensor_quality, qualityValue);
  assertEqual(rawQuality.valid, validValue);
  const rawFlags = stringArray(rawQuality.flags);
  if (rawFlags.length !== flags.length || rawFlags.some((flag, index) => flag !== flags[index])) invalid();

  const expectedEventKey = ["AS1", config.layout_id, config.packet_type, SOURCE_IDENTITY.ticker_id, selection.timeframe, String(barCloseTime), "as1.v1.4"].join("|");
  assertEqual(row.client_event_key, expectedEventKey);
  assertEqual(rawEnvelope.client_event_key, expectedEventKey);

  const payload = selection.view === "MAAT"
    ? projectMaatPayload(rawEnvelope.payload)
    : selection.view === "MAAT2_HUB"
    ? projectHubPayload(rawEnvelope.payload)
    : projectTimePayload(rawEnvelope.payload);
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) invalid();

  return {
    ok: true,
    api_schema_version: API_SCHEMA_VERSION,
    generated_at: new Date(nowMs).toISOString(),
    view: selection.view,
    source: {
      schema_version: SOURCE_IDENTITY.schema_version,
      satellite_id: SOURCE_IDENTITY.satellite_id,
      platform: SOURCE_IDENTITY.platform,
      layout_id: config.layout_id,
      observer: config.observer,
      code_version: config.code_version,
      source_profile_code: SOURCE_IDENTITY.source_profile_code,
      packet_type: config.packet_type,
    },
    instrument: {ticker_id: SOURCE_IDENTITY.ticker_id, venue: SOURCE_IDENTITY.venue, symbol: SOURCE_IDENTITY.symbol},
    timeframe: selection.timeframe,
    bar: {open_time: barOpenTime, close_time: barCloseTime, close: numberValue(rawBar.close)},
    received_at: receivedAt.iso,
    quality: {sensor_quality: qualityValue, valid: validValue, flags},
    payload,
    freshness: computeFreshness(receivedAt.milliseconds, nowMs, TIMEFRAME_CADENCE_SECONDS[selection.timeframe]),
  };
}
