import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {type IngestRow, type JsonRecord, type ValidatedIngestRequest, ValidationError, validateIngestRequest} from "./validate-envelope.ts";
import {persistRows} from "./persist-rows.ts";

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

async function insertEvents(rows: IngestRow[], requestEventKey: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("as1-ingest configuration missing", {request_event_key: requestEventKey, rejected_frames: rows.length});
    return;
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}});
  // Frames remain independent in the existing asynchronous insert architecture:
  // validation is all-or-nothing, while DB conflicts/failures are isolated and summarized per frame.
  const summary = await persistRows(rows, async (row) => {
    const {error} = await client.from("as1_raw_events").insert(row);
    return {error: error ? {code: error.code, message: error.message} : null};
  });
  for (const failure of summary.failures) {
    console.error("as1-ingest background insert failed", failure);
  }
  console.info("as1-ingest background insert complete", {
    request_event_key: requestEventKey,
    accepted_frames: summary.accepted_frames,
    duplicate_frames: summary.duplicate_frames,
    rejected_frames: summary.rejected_frames,
  });
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

    let ingestRequest: ValidatedIngestRequest;
    try {
      ingestRequest = validateIngestRequest(envelope);
    } catch (error) {
      const detail = error instanceof ValidationError ? error.message : "validation failed";
      return jsonResponse({ok: false, error: "INVALID_ENVELOPE", detail}, 400);
    }

    EdgeRuntime.waitUntil(insertEvents(ingestRequest.rows, ingestRequest.request_event_key));
    if (ingestRequest.kind === "bundle") {
      return jsonResponse({
        ok: true,
        accepted: true,
        queued: true,
        schema_version: ingestRequest.schema_version,
        batch_event_key: ingestRequest.request_event_key,
        accepted_frames: ingestRequest.rows.length,
        duplicate_frames: ingestRequest.duplicate_frames,
        rejected_frames: 0,
      }, 202);
    }

    const row = ingestRequest.rows[0];
    return jsonResponse({ok: true, accepted: true, queued: true, schema_version: row.schema_version, client_event_key: row.client_event_key}, 202);
  },
};
