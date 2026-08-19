export const API_SCHEMA_VERSION = "as1-weather-read.v1";
export const CADENCE_SECONDS = 14_400;

export const FIXED_IDENTITY = Object.freeze({
  schema_version: "as1.v1.3",
  satellite_id: "AS1",
  platform: "TRADINGVIEW",
  layout_id: "HORUS_A",
  observer: "HORUS",
  code_version: "HETEM_GATE_V1_AS1_V1_3",
  source_profile_code: "CB_BTCUSD_SPOT_20260722_V1",
  ticker_id: "COINBASE:BTCUSD",
  venue: "COINBASE",
  symbol: "BTCUSD",
  timeframe: "240",
  packet_type: "BAR_CLOSE_SNAPSHOT",
  confirmed: true,
  valid: true,
  sensor_quality: "GOOD",
});

const FRESH_MAX_MS = 4.5 * 60 * 60 * 1000;
const AGING_MAX_MS = 8.5 * 60 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const INVALID_FUTURE_MS = 5 * 60 * 1000;
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

type JsonRecord = Record<string, unknown>;
type SafeScalar = string | number | boolean;

export type FreshnessState =
  | "FRESH"
  | "AGING"
  | "STALE"
  | "EXPIRED"
  | "INVALID_CLOCK";

export class ProjectionError extends Error {
  readonly code = "INVALID_OBSERVATION";

  constructor() {
    super("Observation failed public projection validation");
    this.name = "ProjectionError";
  }
}

function invalid(): never {
  throw new ProjectionError();
}

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid();
  }

  return value as JsonRecord;
}

function positiveSafeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    invalid();
  }

  return value as number;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid();
  }

  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    invalid();
  }

  return [...value];
}

function isoTimestamp(value: unknown): { iso: string; milliseconds: number } {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
    invalid();
  }

  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    invalid();
  }

  return { iso: new Date(milliseconds).toISOString(), milliseconds };
}

function optionalSafeScalar(
  section: JsonRecord,
  key: string,
): SafeScalar | undefined {
  if (!(key in section)) {
    return undefined;
  }

  const value = section[key];

  if (
    value === null ||
    (typeof value !== "string" && typeof value !== "boolean" &&
      (typeof value !== "number" || !Number.isFinite(value)))
  ) {
    invalid();
  }

  return value as SafeScalar;
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    invalid();
  }
}

function assertStringArraysEqual(actual: string[], expected: string[]): void {
  if (
    actual.length !== expected.length ||
    actual.some((item, index) => item !== expected[index])
  ) {
    invalid();
  }
}

function projectPayload(rawPayload: unknown) {
  const payload = record(rawPayload);
  const context = record(payload.context);
  const horus = record(payload.horus);
  const hetem = record(payload.hetem);
  const gaw = record(payload.gaw);
  const event = record(payload.event);

  // Every public nested field is named explicitly. Never spread a raw payload.
  return {
    context: {
      system: optionalSafeScalar(context, "system"),
      engine: optionalSafeScalar(context, "engine"),
      season: optionalSafeScalar(context, "season"),
      season_code: optionalSafeScalar(context, "season_code"),
      group: optionalSafeScalar(context, "group"),
      layer: optionalSafeScalar(context, "layer"),
    },
    horus: {
      dir: optionalSafeScalar(horus, "dir"),
      state: optionalSafeScalar(horus, "state"),
      risk: optionalSafeScalar(horus, "risk"),
      total: optionalSafeScalar(horus, "total"),
      block: optionalSafeScalar(horus, "block"),
      flow: optionalSafeScalar(horus, "flow"),
      next_tf: optionalSafeScalar(horus, "next_tf"),
      mode_code: optionalSafeScalar(horus, "mode_code"),
    },
    hetem: {
      gate_state: optionalSafeScalar(hetem, "gate_state"),
      gate_score: optionalSafeScalar(hetem, "gate_score"),
      pressure_index: optionalSafeScalar(hetem, "pressure_index"),
      pressure_band: optionalSafeScalar(hetem, "pressure_band"),
    },
    gaw: {
      gv: optionalSafeScalar(gaw, "gv"),
      ec: optionalSafeScalar(gaw, "ec"),
      es: optionalSafeScalar(gaw, "es"),
      gp: optionalSafeScalar(gaw, "gp"),
      gaw_code: optionalSafeScalar(gaw, "gaw_code"),
      gaw_line: optionalSafeScalar(gaw, "gaw_line"),
    },
    event: {
      primary_name: optionalSafeScalar(event, "primary_name"),
      trigger: optionalSafeScalar(event, "trigger"),
      bar_status: optionalSafeScalar(event, "bar_status"),
      primary_code: optionalSafeScalar(event, "primary_code"),
    },
  };
}

export function computeFreshness(receivedAtMs: number, nowMs: number) {
  if (!Number.isFinite(receivedAtMs) || !Number.isFinite(nowMs)) {
    invalid();
  }

  const ageMs = nowMs - receivedAtMs;
  let state: FreshnessState;

  if (ageMs <= -INVALID_FUTURE_MS) {
    state = "INVALID_CLOCK";
  } else if (ageMs <= FRESH_MAX_MS) {
    state = "FRESH";
  } else if (ageMs <= AGING_MAX_MS) {
    state = "AGING";
  } else if (ageMs <= STALE_MAX_MS) {
    state = "STALE";
  } else {
    state = "EXPIRED";
  }

  return {
    state,
    age_seconds: Math.max(0, Math.floor(ageMs / 1000)),
    cadence_seconds: CADENCE_SECONDS,
  };
}

export function projectWeatherResponse(rowValue: unknown, now = new Date()) {
  const row = record(rowValue);

  for (const [key, expected] of Object.entries(FIXED_IDENTITY)) {
    assertEqual(row[key], expected);
  }

  const barOpenTime = positiveSafeInteger(row.bar_open_time);
  const barCloseTime = positiveSafeInteger(row.bar_close_time);

  if (barOpenTime >= barCloseTime) {
    invalid();
  }

  const flags = stringArray(row.flags);
  const receivedAt = isoTimestamp(row.received_at);
  const nowMs = now.getTime();

  if (!Number.isFinite(nowMs)) {
    invalid();
  }

  const rawEnvelope = record(row.raw_envelope);
  const rawInstrument = record(rawEnvelope.instrument);
  const rawTiming = record(rawEnvelope.timing);
  const rawBar = record(rawEnvelope.bar);
  const rawQuality = record(rawEnvelope.quality);

  for (
    const key of [
      "schema_version",
      "satellite_id",
      "platform",
      "layout_id",
      "observer",
      "code_version",
      "source_profile_code",
      "packet_type",
      "confirmed",
    ]
  ) {
    assertEqual(rawEnvelope[key], row[key]);
  }

  assertEqual(rawInstrument.ticker_id, row.ticker_id);
  assertEqual(rawInstrument.venue, row.venue);
  assertEqual(rawInstrument.symbol, row.symbol);
  assertEqual(rawTiming.timeframe, row.timeframe);
  assertEqual(rawTiming.bar_open_time, barOpenTime);
  assertEqual(rawTiming.bar_close_time, barCloseTime);
  assertEqual(rawQuality.sensor_quality, row.sensor_quality);
  assertEqual(rawQuality.valid, row.valid);
  assertStringArraysEqual(stringArray(rawQuality.flags), flags);

  const close = finiteNumber(rawBar.close);

  return {
    ok: true,
    api_schema_version: API_SCHEMA_VERSION,
    generated_at: new Date(nowMs).toISOString(),
    source: {
      schema_version: FIXED_IDENTITY.schema_version,
      satellite_id: FIXED_IDENTITY.satellite_id,
      platform: FIXED_IDENTITY.platform,
      layout_id: FIXED_IDENTITY.layout_id,
      observer: FIXED_IDENTITY.observer,
      code_version: FIXED_IDENTITY.code_version,
      source_profile_code: FIXED_IDENTITY.source_profile_code,
    },
    instrument: {
      ticker_id: FIXED_IDENTITY.ticker_id,
      venue: FIXED_IDENTITY.venue,
      symbol: FIXED_IDENTITY.symbol,
    },
    timeframe: FIXED_IDENTITY.timeframe,
    bar: {
      open_time: barOpenTime,
      close_time: barCloseTime,
      close,
    },
    received_at: receivedAt.iso,
    quality: {
      sensor_quality: FIXED_IDENTITY.sensor_quality,
      valid: FIXED_IDENTITY.valid,
      flags,
    },
    payload: projectPayload(rawEnvelope.payload),
    freshness: computeFreshness(receivedAt.milliseconds, nowMs),
  };
}
