import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {type IngestRow, type JsonRecord, ValidationError, validateEnvelope} from "./validate-envelope.ts";

declare const EdgeRuntime: {waitUntil(promise: Promise<unknown>): void};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const MAX_BODY_BYTES = 128 * 1024;

function jsonResponse(body: JsonRecord, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS, ...extraHeaders},
  });
}

async function insertEvent(row: IngestRow): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("as1-ingest configuration missing");
    return;
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}});
  const {error} = await client.from("as1_raw_events").insert(row);
  if (error?.code === "23505") {
    console.info("as1-ingest duplicate suppressed", {client_event_key: row.client_event_key});
    return;
  }
  if (error) {
    console.error("as1-ingest background insert failed", {code: error.code, message: error.message});
    return;
  }
  console.info("as1-ingest background insert success", {client_event_key: row.client_event_key});
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: {...CORS_HEADERS, "Cache-Control": "no-store"}});
    if (req.method !== "POST") return jsonResponse({ok: false, error: "METHOD_NOT_ALLOWED"}, 405, {Allow: "POST, OPTIONS"});

    const configuredToken = Deno.env.get("AS1_WEBHOOK_TOKEN");
    if (!configuredToken) {
      console.error("as1-ingest webhook token is not configured");
      return jsonResponse({ok: false, error: "SERVICE_UNAVAILABLE"}, 503);
    }
    if (new URL(req.url).searchParams.get("token") !== configuredToken) return jsonResponse({ok: false, error: "UNAUTHORIZED"}, 401);

    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return jsonResponse({ok: false, error: "PAYLOAD_TOO_LARGE"}, 413);

    let text: string;
    try {
      text = await req.text();
    } catch {
      return jsonResponse({ok: false, error: "BODY_READ_FAILED"}, 400);
    }
    if (text.length === 0) return jsonResponse({ok: false, error: "EMPTY_BODY"}, 400);
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return jsonResponse({ok: false, error: "PAYLOAD_TOO_LARGE"}, 413);

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return jsonResponse({ok: false, error: "INVALID_JSON"}, 400);
    }

    let row: IngestRow;
    try {
      row = validateEnvelope(envelope);
    } catch (error) {
      const detail = error instanceof ValidationError ? error.message : "validation failed";
      return jsonResponse({ok: false, error: "INVALID_ENVELOPE", detail}, 400);
    }

    EdgeRuntime.waitUntil(insertEvent(row));
    return jsonResponse({ok: true, accepted: true, queued: true, schema_version: row.schema_version, client_event_key: row.client_event_key}, 202);
  },
};
