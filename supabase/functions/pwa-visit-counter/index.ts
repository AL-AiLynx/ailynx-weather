const BASE_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
});

export type VisitStats = Readonly<{
  total_visits: number;
  today_visits: number;
}>;

type VisitStore = Readonly<{
  read: (date: string) => Promise<VisitStats>;
  record: (date: string) => Promise<VisitStats>;
}>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8"},
  });
}

function kstDateFromParts(parts: Intl.DateTimeFormatPart[]) {
  const values: Record<string, string> = {};
  parts.forEach((part) => {
    values[part.type] = part.value;
  });
  return `${values.year}-${values.month}-${values.day}`;
}

export function kstDate(now = new Date()) {
  return kstDateFromParts(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now));
}

export function validStats(value: unknown): value is VisitStats {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const stats = value as Record<string, unknown>;
  return Number.isSafeInteger(stats.total_visits) && Number.isSafeInteger(stats.today_visits) &&
    (stats.total_visits as number) >= 0 && (stats.today_visits as number) >= 0;
}

export function createHandler(store: VisitStore, now: () => Date = () => new Date()) {
  return async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: BASE_HEADERS});
    if (request.method !== "GET" && request.method !== "POST") {
      return jsonResponse({ok: false, error: "METHOD_NOT_ALLOWED"}, 405);
    }

    try {
      const date = kstDate(now());
      const stats = request.method === "POST" ? await store.record(date) : await store.read(date);
      if (!validStats(stats)) throw new Error("INVALID_STATS");
      return jsonResponse({ok: true, stats: {...stats, date}});
    } catch {
      return jsonResponse({ok: false, error: "SERVICE_UNAVAILABLE"}, 503);
    }
  };
}

async function createSupabaseStore(): Promise<VisitStore> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SERVER_CONFIGURATION_UNAVAILABLE");

  const {createClient} = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const invoke = async (rpc: "get_pwa_visit_stats" | "record_pwa_visit", date: string) => {
    const {data, error} = await supabase.rpc(rpc, {p_today: date}).single();
    if (error || !validStats(data)) throw new Error("DATABASE_QUERY_FAILED");
    return data;
  };

  return {
    read: (date) => invoke("get_pwa_visit_stats", date),
    record: (date) => invoke("record_pwa_visit", date),
  };
}

if (import.meta.main) {
  const store = await createSupabaseStore();
  Deno.serve(createHandler(store));
}
