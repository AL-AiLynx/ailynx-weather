import {
  API_SCHEMA_VERSION,
  ProjectionError,
  resolveSelection,
  SOURCE_IDENTITY,
  type Selection,
  VIEW_CONFIGS,
  projectValidationResponse,
} from "./project-response.ts";

const TABLE = "as1_raw_events";
const BASE_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
});

type FetchLatest = (selection: Selection) => Promise<unknown | null>;

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...BASE_HEADERS, ...extraHeaders, "Content-Type": "application/json; charset=utf-8"},
  });
}

function publicError(error: string, status: number, extraHeaders: Record<string, string> = {}) {
  return jsonResponse({ok: false, api_schema_version: API_SCHEMA_VERSION, error}, status, extraHeaders);
}

export async function fetchLatestObservation(selection: Selection): Promise<unknown | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SERVER_CONFIGURATION_UNAVAILABLE");

  const {createClient} = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}});
  const config = VIEW_CONFIGS[selection.view];
  const {data, error} = await supabase
    .from(TABLE)
    .select([
      "received_at", "schema_version", "satellite_id", "platform", "layout_id", "observer", "code_version",
      "source_profile_code", "ticker_id", "venue", "symbol", "timeframe", "bar_open_time", "bar_close_time",
      "packet_type", "confirmed", "sensor_quality", "valid", "flags", "client_event_key", "raw_envelope",
    ].join(","))
    .eq("schema_version", SOURCE_IDENTITY.schema_version)
    .eq("satellite_id", SOURCE_IDENTITY.satellite_id)
    .eq("platform", SOURCE_IDENTITY.platform)
    .eq("layout_id", config.layout_id)
    .eq("observer", config.observer)
    .eq("code_version", config.code_version)
    .eq("source_profile_code", SOURCE_IDENTITY.source_profile_code)
    .eq("ticker_id", SOURCE_IDENTITY.ticker_id)
    .eq("venue", SOURCE_IDENTITY.venue)
    .eq("symbol", SOURCE_IDENTITY.symbol)
    .eq("timeframe", selection.timeframe)
    .eq("packet_type", config.packet_type)
    .eq("confirmed", true)
    .order("bar_close_time", {ascending: false})
    .order("received_at", {ascending: false})
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("DATABASE_QUERY_FAILED");
  return data;
}

export function createHandler(
  fetchLatest: FetchLatest = fetchLatestObservation,
  now: () => Date = () => new Date(),
) {
  return async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: BASE_HEADERS});
    if (request.method !== "GET") return publicError("METHOD_NOT_ALLOWED", 405, {Allow: "GET, OPTIONS"});

    const selection = resolveSelection(request.url);
    if (!selection) return publicError("INVALID_SELECTION", 400);

    try {
      const row = await fetchLatest(selection);
      if (row === null) return publicError("NO_OBSERVATION", 404);
      return jsonResponse(projectValidationResponse(row, selection, now()), 200);
    } catch (error) {
      if (error instanceof ProjectionError) return publicError("INVALID_OBSERVATION", 502);
      return publicError("SERVICE_UNAVAILABLE", 503);
    }
  };
}

if (import.meta.main) Deno.serve(createHandler());
