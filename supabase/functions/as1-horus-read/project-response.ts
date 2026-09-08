import {computeFreshness} from "../as1-validation-read/project-response.ts";

export const API_SCHEMA_VERSION = "as1-horus-read.v1";
const QUALITY = new Set(["GOOD", "LIMITED", "WATCH", "INVALID"]);
export const CANONICAL_TIMEFRAMES = Object.freeze([
  ...Array.from({length: 23}, (_, i) => ({id: `${i + 1}H`, aliases: [String((i + 1) * 60), `${i + 1}H`]})),
  {id: "1D", aliases: ["D", "1D", "1440", "24H"]},
  ...Array.from({length: 5}, (_, i) => ({id: `${i + 2}D`, aliases: [`${i + 2}D`, String((i + 2) * 1440)]})),
  {id: "1W", aliases: ["W", "1W", "10080"]},
] as const);
export type HorusRows = readonly unknown[];
type Row = Record<string, unknown>;
const bad = (): never => { throw new Error("INVALID_OBSERVATION"); };
const object = (v: unknown): Row => { if (v === null || typeof v !== "object" || Array.isArray(v)) bad(); return v as Row; };
const text = (v: unknown): string => { if (typeof v !== "string" || !v) bad(); return v; };
const num = (v: unknown): number => { if (typeof v !== "number" || !Number.isFinite(v)) bad(); return v; };
const int = (v: unknown): number => { const n = num(v); if (!Number.isSafeInteger(n) || n <= 0) bad(); return n; };
const bool = (v: unknown): boolean => { if (typeof v !== "boolean") bad(); return v; };
const strings = (v: unknown): string[] => { if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) bad(); return [...v]; };
const optionalObject = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
function scalar(v: unknown): string | number | boolean | null { if (v === undefined || v === null) return null; if (typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) return v; return bad(); }
function canonical(v: unknown): string | null { return typeof v === "string" ? CANONICAL_TIMEFRAMES.find((item) => (item.aliases as readonly string[]).includes(v))?.id ?? null : null; }
function cadence(tf: string): number { if (tf === "1W") return 604800; const d = /^(\d+)D$/.exec(tf); if (d) return Number(d[1]) * 86400; const h = /^(\d+)H$/.exec(tf); return h ? Number(h[1]) * 3600 : bad(); }

function latest(rows: HorusRows) {
  const selected = new Map<string, Row>();
  for (const candidate of rows) {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const row = candidate as Row; const timeframe = canonical(row.timeframe); if (!timeframe) continue;
    const prior = selected.get(timeframe); const close = typeof row.bar_close_time === "number" ? row.bar_close_time : -1; const received = typeof row.received_at === "string" ? Date.parse(row.received_at) : -1;
    const priorClose = typeof prior?.bar_close_time === "number" ? prior.bar_close_time : -1; const priorReceived = typeof prior?.received_at === "string" ? Date.parse(prior.received_at) : -1;
    if (!prior || close > priorClose || (close === priorClose && received > priorReceived)) selected.set(timeframe, row);
  }
  return selected;
}

function project(value: unknown, timeframe: string, now: Date) {
  const row = object(value), raw = object(row.raw_envelope), instrument = object(raw.instrument), timing = object(raw.timing), bar = object(raw.bar), rawQuality = object(raw.quality);
  const receivedAt = text(row.received_at), receivedAtMs = Date.parse(receivedAt), open = int(row.bar_open_time), close = int(row.bar_close_time), rawTf = text(row.timeframe), sensorQuality = text(row.sensor_quality), valid = bool(row.valid), flags = strings(row.flags);
  if (!Number.isFinite(receivedAtMs) || open >= close || !QUALITY.has(sensorQuality) || row.satellite_id !== "AS1" || row.platform !== "TRADINGVIEW" || row.layout_id !== "HORUS_A" || row.observer !== "HORUS" || row.packet_type !== "BAR_CLOSE_SNAPSHOT" || row.confirmed !== true || row.source_profile_code !== "CB_BTCUSD_SPOT_20260722_V1" || row.ticker_id !== "COINBASE:BTCUSD" || row.venue !== "COINBASE" || row.symbol !== "BTCUSD" || !["as1.v1.3", "as1.v1.4"].includes(text(row.schema_version)) || canonical(rawTf) !== timeframe || raw.layout_id !== row.layout_id || raw.observer !== row.observer || raw.packet_type !== row.packet_type || raw.confirmed !== true || instrument.ticker_id !== row.ticker_id || instrument.venue !== row.venue || instrument.symbol !== row.symbol || timing.timeframe !== rawTf || timing.bar_open_time !== open || timing.bar_close_time !== close || rawQuality.sensor_quality !== sensorQuality || rawQuality.valid !== valid) bad();
  const rawFlags = strings(rawQuality.flags); if (rawFlags.length !== flags.length || rawFlags.some((x, i) => x !== flags[i])) bad();
  const payload = object(raw.payload), horus = optionalObject(payload.horus), hetem = optionalObject(payload.hetem), event = optionalObject(payload.event); const nowMs = now.getTime(); if (!Number.isFinite(nowMs)) bad();
  return {available: true, series: "HORUS_A", symbol: "BTCUSD", ticker_id: "COINBASE:BTCUSD", timeframe, bar: {close: num(bar.close)}, bar_close_time: close, received_at: new Date(receivedAtMs).toISOString(), freshness: computeFreshness(receivedAtMs, nowMs, cadence(timeframe)), quality: {sensor_quality: sensorQuality, valid, flags}, state: {direction: scalar(horus.dir) ?? scalar(payload.direction), state: scalar(horus.state) ?? scalar(payload.state), risk: scalar(horus.risk), score: scalar(horus.total) ?? scalar(payload.total_score), block: scalar(horus.block), flow: scalar(horus.flow), next_timeframe: scalar(horus.next_tf), gate_state: scalar(hetem.gate_state), gate_score: scalar(hetem.gate_score), pressure_index: scalar(hetem.pressure_index), event: scalar(event.primary_name)}};
}

export function projectHorusResponse(rows: HorusRows, now = new Date()) {
  const values = latest(rows); const timeframes = Object.fromEntries(CANONICAL_TIMEFRAMES.map(({id}) => { const row = values.get(id); if (!row) return [id, {available: false, reason: "NO_OBSERVATION"}]; try { return [id, project(row, id, now)]; } catch { return [id, {available: false, reason: "INVALID_OBSERVATION"}]; } }));
  const received = Object.values(timeframes).flatMap((item: any) => item.available ? [Date.parse(item.received_at)] : []).filter(Number.isFinite);
  return {ok: true, api_schema_version: API_SCHEMA_VERSION, generated_at: now.toISOString(), updated_at: received.length ? new Date(Math.max(...received)).toISOString() : null, instrument: {ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD"}, timeframes};
}
