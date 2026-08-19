import {
  API_SCHEMA_VERSION,
  FIXED_IDENTITY,
  ProjectionError,
  projectWeatherResponse,
} from "./project-response.ts";

const TABLE = "as1_raw_events";

// CORS is browser compatibility only. Authorization is enforced by the fixed
// server-side query and strict public projection, not by this header.
const BASE_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
});

type FetchLatest = () => Promise<unknown | null>;

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...BASE_HEADERS,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function publicError(
  error: string,
  status: number,
  extraHeaders: Record<string, string> = {},
) {
  return jsonResponse(
    { ok: false, api_schema_version: API_SCHEMA_VERSION, error },
    status,
    extraHeaders,
  );
}

export async function fetchLatestObservation(): Promise<unknown | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SERVER_CONFIGURATION_UNAVAILABLE");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from(TABLE)
    .select([
      "received_at",
      "schema_version",
      "satellite_id",
      "platform",
      "layout_id",
      "observer",
      "code_version",
      "source_profile_code",
      "ticker_id",
      "venue",
      "symbol",
      "timeframe",
      "bar_open_time",
      "bar_close_time",
      "packet_type",
      "confirmed",
      "sensor_quality",
      "valid",
      "flags",
      "raw_envelope",
    ].join(","))
    .eq("schema_version", FIXED_IDENTITY.schema_version)
    .eq("satellite_id", FIXED_IDENTITY.satellite_id)
    .eq("platform", FIXED_IDENTITY.platform)
    .eq("layout_id", FIXED_IDENTITY.layout_id)
    .eq("observer", FIXED_IDENTITY.observer)
    .eq("code_version", FIXED_IDENTITY.code_version)
    .eq("source_profile_code", FIXED_IDENTITY.source_profile_code)
    .eq("ticker_id", FIXED_IDENTITY.ticker_id)
    .eq("venue", FIXED_IDENTITY.venue)
    .eq("symbol", FIXED_IDENTITY.symbol)
    .eq("timeframe", FIXED_IDENTITY.timeframe)
    .eq("packet_type", FIXED_IDENTITY.packet_type)
    .eq("confirmed", FIXED_IDENTITY.confirmed)
    .eq("valid", FIXED_IDENTITY.valid)
    .eq("sensor_quality", FIXED_IDENTITY.sensor_quality)
    .order("bar_close_time", { ascending: false })
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_QUERY_FAILED");
  }

  return data;
}

export function createHandler(
  fetchLatest: FetchLatest = fetchLatestObservation,
  now: () => Date = () => new Date(),
) {
  return async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: BASE_HEADERS });
    }

    if (request.method !== "GET") {
      return publicError("METHOD_NOT_ALLOWED", 405, { Allow: "GET, OPTIONS" });
    }

    try {
      // The request URL and query parameters intentionally cannot affect the query.
      const row = await fetchLatest();

      if (row === null) {
        return publicError("NO_VALID_4H_OBSERVATION", 404);
      }

      return jsonResponse(projectWeatherResponse(row, now()), 200);
    } catch (error) {
      if (error instanceof ProjectionError) {
        return publicError("INVALID_OBSERVATION", 502);
      }

      // Never serialize, return, or log raw database/configuration errors here.
      return publicError("SERVICE_UNAVAILABLE", 503);
    }
  };
}

if (import.meta.main) {
  Deno.serve(createHandler());
}
