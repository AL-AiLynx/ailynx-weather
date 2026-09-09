const ASSETS = new Set(["BTCUSD", "US100", "XAUUSD", "DXY"]);
const HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
});

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: {...HEADERS, "Content-Type": "application/json; charset=utf-8"},
});

function bearerToken(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  return match?.[1]?.trim() || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: HEADERS});
  if (request.method !== "GET") return json({ok: false, error: "METHOD_NOT_ALLOWED"}, 405);
  const asset = new URL(request.url).searchParams.get("asset") || "";
  if (!ASSETS.has(asset)) return json({ok: false, error: "UNSUPPORTED_ASSET"}, 400);

  const token = bearerToken(request);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return json({ok: false, error: "AUTH_REQUIRED"}, 401);
  if (!url || !serviceRoleKey) return json({ok: false, error: "SERVICE_UNAVAILABLE"}, 503);

  try {
    const {createClient} = await import("@supabase/supabase-js");
    const server = createClient(url, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}});
    const {data: identity, error: identityError} = await server.auth.getUser(token);
    if (identityError || !identity.user) return json({ok: false, error: "AUTH_REQUIRED"}, 401);

    const adminCheck = await fetch(`${url}/rest/v1/rpc/is_current_user_admin`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const isAdmin = adminCheck.ok && (await adminCheck.json().catch(() => false)) === true;
    if (!isAdmin) return json({ok: false, error: "ADMIN_REQUIRED"}, 403);

    const upstream = await fetch(`${url}/functions/v1/as1-asset-read?asset=${encodeURIComponent(asset)}`, {
      headers: {apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`},
    });
    if (!upstream.ok) return json({ok: false, error: upstream.status === 404 ? "NO_OBSERVATION" : "SERVICE_UNAVAILABLE"}, upstream.status === 404 ? 404 : 503);
    return new Response(await upstream.text(), {
      status: 200,
      headers: {...HEADERS, "Content-Type": "application/json; charset=utf-8"},
    });
  } catch {
    return json({ok: false, error: "SERVICE_UNAVAILABLE"}, 503);
  }
});
