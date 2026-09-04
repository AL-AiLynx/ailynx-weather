export type JsonRecord = Record<string, unknown>;

export type IngestRow = {
  schema_version: string;
  satellite_id: string;
  platform: string;
  layout_id: string;
  observer: string;
  code_version: string;
  source_profile_code: string;
  ticker_id: string;
  venue: string;
  symbol: string;
  timeframe: string;
  bar_open_time: number;
  bar_close_time: number;
  sent_at: number;
  bar_duration_ms: number;
  packet_type: string;
  confirmed: boolean;
  sensor_quality: string;
  valid: boolean;
  flags: string[];
  client_event_key: string;
  raw_envelope: JsonRecord;
};

const ALLOWED_LAYOUTS = new Set(["HORUS_A", "HORUS_B", "MAAT", "MAAT2"]);
const ALLOWED_QUALITY = new Set(["GOOD", "LIMITED", "WATCH", "INVALID"]);
const TOP_LEVEL_KEYS = new Set([
  "schema_version", "satellite_id", "platform", "layout_id", "observer", "code_version",
  "source_profile_code", "instrument", "session_hint", "timing", "bar", "packet_type",
  "confirmed", "quality", "client_event_key", "payload",
]);

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(parent: JsonRecord, key: string): JsonRecord {
  const value = parent[key];
  if (!isRecord(value)) throw new ValidationError(`${key} must be an object`);
  return value;
}

function requireString(parent: JsonRecord, key: string): string {
  const value = parent[key];
  if (typeof value !== "string" || value.length === 0) throw new ValidationError(`${key} must be a non-empty string`);
  return value;
}

function requireBoolean(parent: JsonRecord, key: string): boolean {
  const value = parent[key];
  if (typeof value !== "boolean") throw new ValidationError(`${key} must be boolean`);
  return value;
}

function requireNumber(parent: JsonRecord, key: string, minimum?: number, maximum?: number): number {
  const value = parent[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ValidationError(`${key} must be a finite number`);
  if (minimum !== undefined && value < minimum) throw new ValidationError(`${key} is below minimum`);
  if (maximum !== undefined && value > maximum) throw new ValidationError(`${key} is above maximum`);
  return value;
}

function requireInteger(parent: JsonRecord, key: string, minimum?: number, maximum?: number): number {
  const value = requireNumber(parent, key, minimum, maximum);
  if (!Number.isSafeInteger(value)) throw new ValidationError(`${key} must be a safe integer`);
  return value;
}

function requireNull(parent: JsonRecord, key: string): void {
  if (!Object.hasOwn(parent, key) || parent[key] !== null) throw new ValidationError(`${key} must be null`);
}

function requireStringType(parent: JsonRecord, key: string): string {
  const value = parent[key];
  if (typeof value !== "string") throw new ValidationError(`${key} must be a string`);
  return value;
}

function requireEpochMs(parent: JsonRecord, key: string): number {
  const value = parent[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${key} must be a positive integer epoch-millisecond value`);
  }
  return value;
}

function requireLiteral(parent: JsonRecord, key: string, expected: string): void {
  if (parent[key] !== expected) throw new ValidationError(`${key} must be ${expected}`);
}

function requireEnum(parent: JsonRecord, key: string, values: readonly string[]): void {
  if (typeof parent[key] !== "string" || !values.includes(parent[key])) throw new ValidationError(`${key} is unsupported`);
}

function rejectUnknownKeys(value: JsonRecord, allowed: Set<string>, context: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new ValidationError(`${context}.${unknown} is not allowed`);
}

function hasOwnRecursive(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasOwnRecursive(item, key));
  if (!isRecord(value)) return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((item) => hasOwnRecursive(item, key));
}

function validateSensor(value: unknown, context: string): void {
  if (!isRecord(value)) throw new ValidationError(`${context} must be an object`);
  rejectUnknownKeys(value, new Set(["linked", "valid", "direction_state_code", "score", "risk_code", "event_code"]), context);
  requireBoolean(value, "linked");
  requireBoolean(value, "valid");
  requireInteger(value, "direction_state_code", -1, 1);
  requireNumber(value, "score", 0, 100);
  requireInteger(value, "risk_code", 0, 5);
  requireInteger(value, "event_code", 0, 9);
}

function validateScoreSet(value: JsonRecord): void {
  rejectUnknownKeys(value, new Set(["structure", "force", "window", "risk"]), "scores");
  for (const key of ["structure", "force", "window", "risk"]) requireNumber(value, key, 0, 100);
}

function validateGuardState(value: JsonRecord): void {
  rejectUnknownKeys(value, new Set(["mask", "window", "force", "noise", "reset"]), "guards");
  requireInteger(value, "mask", 0, 15);
  for (const key of ["window", "force", "noise", "reset"]) requireBoolean(value, key);
}

function validateAlertState(value: JsonRecord): void {
  rejectUnknownKeys(value, new Set(["mask", "window_open", "force_event", "noise_only", "reset_required"]), "alerts");
  requireInteger(value, "mask", 0, 15);
  for (const key of ["window_open", "force_event", "noise_only", "reset_required"]) requireBoolean(value, key);
}

function validateMaatPayload(payload: JsonRecord): void {
  rejectUnknownKeys(payload, new Set(["contract_version", "record_status", "validation_outcome", "automatic_hit_miss", "aggregate", "sensors", "stopwatch"]), "payload");
  requireLiteral(payload, "contract_version", "maat.validation.v1");
  requireEnum(payload, "record_status", ["OFF", "WATCH", "WINDOW_OPEN", "EVENT_OBSERVED", "RESET"]);
  requireLiteral(payload, "validation_outcome", "PENDING");
  requireLiteral(payload, "automatic_hit_miss", "SUPPRESSED");
  const aggregate = requireRecord(payload, "aggregate");
  rejectUnknownKeys(aggregate, new Set(["state_code", "score", "risk_code", "event_code", "sync_count", "conflict_count", "lie_score", "lie_code", "why_code", "direction_state_code", "direction_semantics"]), "payload.aggregate");
  requireInteger(aggregate, "state_code", 0, 6);
  requireNumber(aggregate, "score", 0, 100);
  requireInteger(aggregate, "risk_code", 0, 5);
  requireInteger(aggregate, "event_code", 0, 9);
  requireInteger(aggregate, "sync_count", 0, 6);
  requireInteger(aggregate, "conflict_count", 0, 6);
  requireNumber(aggregate, "lie_score", 0, 100);
  requireInteger(aggregate, "lie_code", 0, 3);
  requireInteger(aggregate, "why_code", 0, 9);
  requireInteger(aggregate, "direction_state_code", -1, 1);
  requireLiteral(aggregate, "direction_semantics", "OBSERVED_SENSOR_STATE_NOT_PREDICTION");
  const sensors = requireRecord(payload, "sensors");
  rejectUnknownKeys(sensors, new Set(["rpc", "structure", "volume", "heru", "wenut", "rsi"]), "payload.sensors");
  for (const name of ["rpc", "structure", "volume", "heru", "wenut", "rsi"]) validateSensor(sensors[name], `payload.sensors.${name}`);
  const stopwatch = requireRecord(payload, "stopwatch");
  rejectUnknownKeys(stopwatch, new Set(["phase", "main_tf_minutes", "parent_tf_minutes", "target_time", "window_start", "window_end", "remaining_minutes", "in_window", "noise_score", "volume_event_observed", "volume_type", "rvol"]), "payload.stopwatch");
  requireString(stopwatch, "phase");
  requireInteger(stopwatch, "main_tf_minutes", 1);
  requireInteger(stopwatch, "parent_tf_minutes", 1);
  requireInteger(stopwatch, "target_time", 0);
  requireInteger(stopwatch, "window_start", 0);
  requireInteger(stopwatch, "window_end", 0);
  requireNumber(stopwatch, "remaining_minutes", 0);
  requireBoolean(stopwatch, "in_window");
  requireInteger(stopwatch, "noise_score", 0, 100);
  requireBoolean(stopwatch, "volume_event_observed");
  requireStringType(stopwatch, "volume_type");
  requireNumber(stopwatch, "rvol", 0);
  if (hasOwnRecursive(payload, "prediction_direction") || hasOwnRecursive(payload, "hit_miss")) {
    throw new ValidationError("MAAT prediction and HIT/MISS fields are forbidden");
  }
}

function validateHubPayload(payload: JsonRecord): void {
  rejectUnknownKeys(payload, new Set(["contract_version", "record_status", "validation_outcome", "scores", "phase", "guards", "alerts", "sources", "diagnostics"]), "payload");
  requireLiteral(payload, "contract_version", "maat2.hub.v1");
  requireEnum(payload, "record_status", ["WATCH", "WINDOW_OPEN", "FORCE_EVENT", "NOISE_ONLY", "RESET"]);
  requireLiteral(payload, "validation_outcome", "PENDING");
  validateScoreSet(requireRecord(payload, "scores"));
  const phase = requireRecord(payload, "phase");
  rejectUnknownKeys(phase, new Set(["raw_code", "candidate_result_code", "final_result_code"]), "payload.phase");
  requireInteger(phase, "raw_code", 0, 11);
  requireInteger(phase, "candidate_result_code", 0, 4);
  requireInteger(phase, "final_result_code", 0, 4);
  validateGuardState(requireRecord(payload, "guards"));
  validateAlertState(requireRecord(payload, "alerts"));
  const sources = requireRecord(payload, "sources");
  rejectUnknownKeys(sources, new Set(["was_valid", "true_vol_valid", "expansion_state_code", "peripheral_state_code", "system_partial", "system_invalid", "heru_mode"]), "payload.sources");
  requireBoolean(sources, "was_valid");
  requireBoolean(sources, "true_vol_valid");
  requireInteger(sources, "expansion_state_code", 0, 3);
  requireInteger(sources, "peripheral_state_code", 0, 3);
  requireBoolean(sources, "system_partial");
  requireBoolean(sources, "system_invalid");
  requireLiteral(sources, "heru_mode", "EXTERNAL_ONLY");
  const diagnostics = requireRecord(payload, "diagnostics");
  rejectUnknownKeys(diagnostics, new Set(["note_code", "layer_note_code", "filter_note_code", "background_support", "risk_block", "bridge_valid"]), "payload.diagnostics");
  requireInteger(diagnostics, "note_code", 0);
  requireInteger(diagnostics, "layer_note_code", 0);
  requireInteger(diagnostics, "filter_note_code", 0);
  requireBoolean(diagnostics, "background_support");
  requireBoolean(diagnostics, "risk_block");
  requireBoolean(diagnostics, "bridge_valid");
  for (const forbidden of ["prediction_direction", "automatic_hit_miss", "hit_miss"]) {
    if (hasOwnRecursive(payload, forbidden)) throw new ValidationError(`MAAT2 Hub ${forbidden} is forbidden`);
  }
}

function validateTimePayload(payload: JsonRecord): void {
  rejectUnknownKeys(payload, new Set(["contract_version", "record_status", "validation_outcome", "automatic_hit_miss", "prediction_direction", "scores", "hub", "time"]), "payload");
  requireLiteral(payload, "contract_version", "maat2.time.v1");
  requireEnum(payload, "record_status", ["WATCH", "PRE_WINDOW", "WINDOW_CANDIDATE", "WINDOW_OPEN", "FORCE_EXPRESSION_CANDIDATE", "NOISE_ONLY", "FALSE_RELEASE", "RESET_REQUIRED"]);
  requireLiteral(payload, "validation_outcome", "PENDING");
  requireLiteral(payload, "automatic_hit_miss", "NOT_IMPLEMENTED");
  requireLiteral(payload, "prediction_direction", "NOT_PROVIDED");
  validateScoreSet(requireRecord(payload, "scores"));
  const hub = requireRecord(payload, "hub");
  rejectUnknownKeys(hub, new Set(["phase_code", "result_code", "core_state_code", "peripheral_state_code"]), "payload.hub");
  requireInteger(hub, "phase_code", 0, 11);
  requireInteger(hub, "result_code", 0, 9);
  requireInteger(hub, "core_state_code", 0, 3);
  requireInteger(hub, "peripheral_state_code", 0, 3);
  const time = requireRecord(payload, "time");
  rejectUnknownKeys(time, new Set(["score", "state_code", "role_code", "result_code", "why_code", "noise_score", "candidate_tf_minutes", "parent_tf_minutes", "parent_distance_minutes", "window_flag", "reset_flag", "valid", "guard_mask", "alert_mask", "bars_in_state", "state_change_count", "diag_code", "expected_window_start", "expected_window_end"]), "payload.time");
  requireInteger(time, "score", 0, 100);
  requireInteger(time, "state_code", 0, 9);
  requireInteger(time, "role_code", 0, 9);
  requireInteger(time, "result_code", 0, 7);
  requireInteger(time, "why_code", 0, 99);
  requireInteger(time, "noise_score", 0, 100);
  requireInteger(time, "candidate_tf_minutes", 0);
  requireInteger(time, "parent_tf_minutes", 0);
  requireInteger(time, "parent_distance_minutes", 0);
  requireBoolean(time, "window_flag");
  requireBoolean(time, "reset_flag");
  requireBoolean(time, "valid");
  requireInteger(time, "guard_mask", 0, 15);
  requireInteger(time, "alert_mask", 0, 15);
  requireInteger(time, "bars_in_state", 0);
  requireNumber(time, "state_change_count", 0);
  requireInteger(time, "diag_code", 0);
  requireNull(time, "expected_window_start");
  requireNull(time, "expected_window_end");
  if (hasOwnRecursive(payload, "hit_miss")) throw new ValidationError("MAAT2 Time HIT/MISS is forbidden");
}

function validateV14Packet(envelope: JsonRecord, layoutId: string, observer: string, packetType: string): void {
  rejectUnknownKeys(envelope, TOP_LEVEL_KEYS, "envelope");
  const payload = requireRecord(envelope, "payload");
  if ((layoutId === "HORUS_A" || layoutId === "HORUS_B") && observer === "HORUS" && packetType === "BAR_CLOSE_SNAPSHOT") return;
  if (layoutId === "MAAT" && observer === "MAAT" && packetType === "VALIDATION_SNAPSHOT") return validateMaatPayload(payload);
  if (layoutId === "MAAT2" && observer === "MAAT2_HUB" && packetType === "HUB_STATE_SNAPSHOT") return validateHubPayload(payload);
  if (layoutId === "MAAT2" && observer === "MAAT2_TIME" && packetType === "TIME_ENGINE_SNAPSHOT") return validateTimePayload(payload);
  throw new ValidationError("layout_id, observer, and packet_type do not form an allowed v1.4 packet");
}

export function validateEnvelope(envelopeValue: unknown): IngestRow {
  if (!isRecord(envelopeValue)) throw new ValidationError("request body must be a JSON object");
  const envelope = envelopeValue;
  const schemaVersion = requireString(envelope, "schema_version");
  const satelliteId = requireString(envelope, "satellite_id");
  const platform = requireString(envelope, "platform");
  const layoutId = requireString(envelope, "layout_id");
  const observer = requireString(envelope, "observer");
  const codeVersion = requireString(envelope, "code_version");
  const sourceProfileCode = requireString(envelope, "source_profile_code");
  const packetType = requireString(envelope, "packet_type");
  const confirmed = requireBoolean(envelope, "confirmed");
  const clientEventKey = requireString(envelope, "client_event_key");

  if (schemaVersion !== "as1.v1.3" && schemaVersion !== "as1.v1.4") throw new ValidationError("unsupported schema_version");
  if (satelliteId !== "AS1") throw new ValidationError("unsupported satellite_id");
  if (platform !== "TRADINGVIEW") throw new ValidationError("unsupported platform");
  if (!ALLOWED_LAYOUTS.has(layoutId)) throw new ValidationError("unsupported layout_id");
  if (!confirmed) throw new ValidationError("confirmed must be true");
  if (schemaVersion === "as1.v1.3" && packetType !== "BAR_CLOSE_SNAPSHOT") throw new ValidationError("unsupported packet_type");
  if (schemaVersion === "as1.v1.4") validateV14Packet(envelope, layoutId, observer, packetType);

  const instrument = requireRecord(envelope, "instrument");
  const tickerId = requireString(instrument, "ticker_id");
  const venue = requireString(instrument, "venue");
  const symbol = requireString(instrument, "symbol");
  requireRecord(envelope, "session_hint");
  requireRecord(envelope, "bar");
  requireRecord(envelope, "payload");

  const timing = requireRecord(envelope, "timing");
  const timeframe = requireString(timing, "timeframe");
  const barOpenTime = requireEpochMs(timing, "bar_open_time");
  const barCloseTime = requireEpochMs(timing, "bar_close_time");
  const sentAt = requireEpochMs(timing, "sent_at");
  if (barCloseTime <= barOpenTime) throw new ValidationError("bar_close_time must be after bar_open_time");
  if (sentAt < barCloseTime) throw new ValidationError("sent_at must not precede bar_close_time");

  const quality = requireRecord(envelope, "quality");
  const sensorQuality = requireString(quality, "sensor_quality");
  const valid = requireBoolean(quality, "valid");
  const flags = quality.flags;
  if (!Array.isArray(flags) || flags.some((flag) => typeof flag !== "string") || new Set(flags).size !== flags.length) {
    throw new ValidationError("quality.flags must be a unique string array");
  }
  if (schemaVersion === "as1.v1.4" && !ALLOWED_QUALITY.has(sensorQuality)) throw new ValidationError("unsupported sensor_quality");

  const expectedEventKey = schemaVersion === "as1.v1.4"
    ? [satelliteId, layoutId, packetType, tickerId, timeframe, String(barCloseTime), schemaVersion].join("|")
    : [satelliteId, layoutId, tickerId, timeframe, String(barCloseTime), schemaVersion].join("|");
  if (clientEventKey !== expectedEventKey) throw new ValidationError("client_event_key does not match envelope identity and timing");

  return {
    schema_version: schemaVersion, satellite_id: satelliteId, platform, layout_id: layoutId, observer, code_version: codeVersion,
    source_profile_code: sourceProfileCode, ticker_id: tickerId, venue, symbol, timeframe, bar_open_time: barOpenTime,
    bar_close_time: barCloseTime, sent_at: sentAt, bar_duration_ms: barCloseTime - barOpenTime, packet_type: packetType,
    confirmed, sensor_quality: sensorQuality, valid, flags: [...flags] as string[], client_event_key: clientEventKey,
    raw_envelope: envelope,
  };
}
