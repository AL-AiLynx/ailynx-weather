type RecordValue = Record<string, unknown>;

const REGISTRY = Object.freeze({
  BTCUSD: {tickerId: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD", sourceProfileCode: "CB_BTCUSD_SPOT_20260722_V1"},
  XAUUSD: {tickerId: "OANDA:XAUUSD", venue: "OANDA", symbol: "XAUUSD", sourceProfileCode: "OANDA_XAUUSD_CFD_V1"},
  DXY: {tickerId: "CAPITALCOM:DXY", venue: "CAPITALCOM", symbol: "DXY", sourceProfileCode: "CAPITALCOM_DXY_CFD_V1"},
  US100: {tickerId: "SKILLING:US100", venue: "SKILLING", symbol: "US100", sourceProfileCode: "SKILLING_US100_CFD_V1"},
});
const HEADERS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Cache-Control": "no-store"};
const RAW_COLUMNS = "received_at,source_profile_code,ticker_id,venue,symbol,timeframe,bar_close_time,confirmed,sensor_quality,valid,flags,raw_envelope";
const RECOVERY_COLUMNS = "asset,ticker_id,venue,symbol,timeframe,recovered_source_profile_code,revalidated,recovery_status,original_observed_at,bar_close_time,bar_close,score,sensor_quality,source_flags";
const object = (value: unknown): RecordValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const canonical = (value: unknown) => {
  if (value === "D" || value === "1D" || value === "1440" || value === "24H") return "1D";
  if (value === "W" || value === "1W") return "1W";
  if (typeof value === "string" && /^\d+D$/.test(value)) return value;
  if (typeof value === "string" && /^\d+H$/.test(value)) return value;
  const minutes = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(minutes) || minutes < 60 || !Number.isInteger(minutes / 60)) return null;
  return minutes % 1440 === 0 ? `${minutes / 1440}D` : `${minutes / 60}H`;
};
const freshness = (observedAt: string) => { const age = Math.max(0, Date.now() - Date.parse(observedAt)) / 1000; return age <= 7200 ? "FRESH" : age <= 21600 ? "AGING" : "STALE"; };

function projectRaw(row: RecordValue, asset: keyof typeof REGISTRY) {
  const expected = REGISTRY[asset], raw = object(row.raw_envelope), instrument = object(raw?.instrument), bar = object(raw?.bar), quality = object(raw?.quality), payload = object(raw?.payload), horus = object(payload?.horus);
  const score = horus?.total;
  if (!raw || !instrument || !bar || !quality || row.ticker_id !== expected.tickerId || row.venue !== expected.venue || row.symbol !== expected.symbol || row.source_profile_code !== expected.sourceProfileCode || instrument.ticker_id !== expected.tickerId || instrument.venue !== expected.venue || instrument.symbol !== expected.symbol || typeof row.received_at !== "string" || !Number.isFinite(Date.parse(row.received_at)) || typeof row.bar_close_time !== "number" || typeof bar.close !== "number" || !Number.isFinite(bar.close) || row.confirmed !== true || typeof row.valid !== "boolean" || typeof row.sensor_quality !== "string" || !Array.isArray(row.flags)) return null;
  const timeframe = canonical(row.timeframe); if (!timeframe) return null;
  return {asset, symbol: expected.symbol, ticker_id: expected.tickerId, timeframe, received_at: new Date(row.received_at).toISOString(), bar_close_time: row.bar_close_time, bar_close: bar.close, confirmed: true, valid: row.valid, sensor_quality: row.sensor_quality, freshness: freshness(row.received_at), flags: row.flags.filter((flag): flag is string => typeof flag === "string"), score: typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null, coverage: "HORUS_ONLY", provenance: "RAW" as const};
}

function projectRecovered(row: RecordValue, asset: keyof typeof REGISTRY) {
  const expected = REGISTRY[asset];
  if (asset !== "US100" || row.asset !== asset || row.ticker_id !== expected.tickerId || row.venue !== expected.venue || row.symbol !== expected.symbol || row.recovered_source_profile_code !== expected.sourceProfileCode || row.revalidated !== true || row.recovery_status !== "RECOVERED" || typeof row.original_observed_at !== "string" || !Number.isFinite(Date.parse(row.original_observed_at)) || typeof row.bar_close_time !== "number" || !Number.isFinite(row.bar_close_time) || row.bar_close_time <= 0 || typeof row.bar_close !== "number" || !Number.isFinite(row.bar_close) || typeof row.score !== "number" || !Number.isFinite(row.score) || row.score < 0 || row.score > 100 || !["GOOD", "LIMITED", "WATCH", "INVALID"].includes(String(row.sensor_quality)) || !Array.isArray(row.source_flags) || row.source_flags.some((flag) => typeof flag !== "string")) return null;
  const timeframe = canonical(row.timeframe); if (!timeframe) return null;
  // Recovery must retain the original bar-close time and can never look current.
  return {asset, symbol: expected.symbol, ticker_id: expected.tickerId, timeframe, received_at: new Date(row.original_observed_at).toISOString(), bar_close_time: row.bar_close_time, bar_close: row.bar_close, confirmed: true, valid: true, sensor_quality: String(row.sensor_quality), freshness: "STALE", flags: [], score: row.score, coverage: "HORUS_ONLY", provenance: "RECOVERED_HISTORY" as const};
}

type RawReceipt = NonNullable<ReturnType<typeof projectRaw>>;
type RecoveredReceipt = NonNullable<ReturnType<typeof projectRecovered>>;
type Receipt = RawReceipt | RecoveredReceipt;

function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), {status, headers: {...HEADERS, "Content-Type": "application/json; charset=utf-8"}}); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: HEADERS});
  if (request.method !== "GET") return json({ok: false, error: "METHOD_NOT_ALLOWED"}, 405);
  const query = new URL(request.url).searchParams;
  const asset = query.get("asset") as keyof typeof REGISTRY;
  if (!Object.hasOwn(REGISTRY, asset)) return json({ok: false, error: "UNSUPPORTED_ASSET"}, 400);
  const suppliedTimeframe = query.get("timeframe");
  const requestedTimeframe = suppliedTimeframe === null ? null : canonical(suppliedTimeframe);
  const suppliedLimit = query.get("limit");
  const requestedLimit = suppliedLimit === null ? 4 : Number(suppliedLimit);
  if ((suppliedTimeframe !== null && !requestedTimeframe) || !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 4) return json({ok: false, error: "INVALID_HISTORY_REQUEST"}, 400);
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) throw new Error();
    const {createClient} = await import("@supabase/supabase-js"); const db = createClient(url, key, {auth: {persistSession: false}}); const expected = REGISTRY[asset];
    const rawQuery = db.from("as1_raw_events").select(RAW_COLUMNS).eq("satellite_id", "AS1").eq("platform", "TRADINGVIEW").eq("layout_id", "HORUS_A").eq("observer", "HORUS").eq("packet_type", "BAR_CLOSE_SNAPSHOT").eq("confirmed", true).eq("source_profile_code", expected.sourceProfileCode).eq("ticker_id", expected.tickerId).eq("venue", expected.venue).eq("symbol", expected.symbol).order("bar_close_time", {ascending: false}).order("received_at", {ascending: false}).limit(500);
    const recoveredQuery = asset === "US100"
      ? db.from("as1_recovered_observations").select(RECOVERY_COLUMNS).eq("asset", asset).eq("ticker_id", expected.tickerId).eq("venue", expected.venue).eq("symbol", expected.symbol).eq("recovered_source_profile_code", expected.sourceProfileCode).eq("revalidated", true).eq("recovery_status", "RECOVERED").order("original_observed_at", {ascending: false}).limit(500)
      : Promise.resolve({data: [], error: null});
    const {data: rawData, error: rawError} = await rawQuery;
    if (rawError) {
      console.error("as1-asset-read raw query failed", {code: rawError.code});
      return json({ok: false, error: "RAW_READ_UNAVAILABLE"}, 503);
    }
    const {data: recoveredData, error: recoveredError} = await recoveredQuery;
    if (recoveredError) {
      console.error("as1-asset-read recovery query failed", {code: recoveredError.code});
      return json({ok: false, error: "SERVICE_UNAVAILABLE"}, 503);
    }
    const rawRows: RecordValue[] = Array.isArray(rawData) ? rawData as RecordValue[] : [];
    const recoveredRows: RecordValue[] = Array.isArray(recoveredData) ? recoveredData as RecordValue[] : [];
    const rawReceipts: RawReceipt[] = rawRows.map((row: RecordValue) => projectRaw(row, asset)).filter((row): row is RawReceipt => row !== null);
    const recoveredReceipts: RecoveredReceipt[] = recoveredRows.map((row: RecordValue) => projectRecovered(row, asset)).filter((row): row is RecoveredReceipt => row !== null);
    const latestValid = new Map<string, RawReceipt>();
    const currentValid = new Map<string, RawReceipt>();
    const recoveredByTimeframe = new Map<string, RecoveredReceipt>();
    for (const receipt of rawReceipts) {
      if (!receipt.valid) continue;
      if (!latestValid.has(receipt.timeframe)) latestValid.set(receipt.timeframe, receipt);
      if (["FRESH", "AGING"].includes(receipt.freshness) && !currentValid.has(receipt.timeframe)) currentValid.set(receipt.timeframe, receipt);
    }
    for (const receipt of recoveredReceipts) if (!recoveredByTimeframe.has(receipt.timeframe)) recoveredByTimeframe.set(receipt.timeframe, receipt);
    const effective = new Map<string, Receipt>(latestValid);
    for (const [timeframe, receipt] of recoveredByTimeframe) if (!effective.has(timeframe)) effective.set(timeframe, receipt);
    const history = requestedTimeframe
      ? ([...rawReceipts.filter((receipt: RawReceipt) => receipt.timeframe === requestedTimeframe && receipt.valid === true && Number.isFinite(receipt.score)), ...recoveredReceipts.filter((receipt: RecoveredReceipt) => receipt.timeframe === requestedTimeframe && Number.isFinite(receipt.score))] as Receipt[])
        .sort((left: Receipt, right: Receipt) => right.bar_close_time - left.bar_close_time || (left.provenance === "RAW" ? -1 : 1))
        .filter((receipt: Receipt, index: number, all: Receipt[]) => index === 0 || receipt.bar_close_time !== all[index - 1].bar_close_time)
        .slice(0, requestedLimit)
      : [];
    const latestReceipt = requestedTimeframe ? currentValid.get(requestedTimeframe) ?? latestValid.get(requestedTimeframe) ?? recoveredByTimeframe.get(requestedTimeframe) ?? null : [...currentValid.values()][0] ?? [...latestValid.values()][0] ?? [...recoveredByTimeframe.values()][0] ?? null;
    const status = currentValid.size ? "LIVE" : latestValid.size ? "STALE" : recoveredByTimeframe.size ? "RECOVERED" : "PLANNED";
    const current = requestedTimeframe ? currentValid.get(requestedTimeframe) ?? null : null;
    const lastKnownGood = requestedTimeframe ? latestValid.get(requestedTimeframe) ?? null : null;
    const recovered = requestedTimeframe ? recoveredByTimeframe.get(requestedTimeframe) ?? null : null;
    return json({
      ok: true, asset, ticker_id: expected.tickerId, source_profile_code: expected.sourceProfileCode, status,
      latest_receipt: latestReceipt, timeframes: Object.fromEntries(effective), current, history, last_known_good: lastKnownGood, recovered,
      current_timeframes: Object.fromEntries(currentValid), last_known_good_timeframes: Object.fromEntries(latestValid), recovered_timeframes: Object.fromEntries(recoveredByTimeframe),
    });
  } catch { return json({ok: false, error: "SERVICE_UNAVAILABLE"}, 503); }
});
