import {ASSET_READERS} from "./asset-registry.js";

export const AS1_ASSET_ENDPOINT = "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-asset-read";
const unavailable = (reason) => ({available: false, reason});

export async function fetchAssetObservations({asset, fetchImpl = globalThis.fetch} = {}) {
  const expected = ASSET_READERS[asset];
  if (!expected || typeof fetchImpl !== "function") return unavailable("UNSUPPORTED_ASSET");
  const url = new URL(AS1_ASSET_ENDPOINT); url.searchParams.set("asset", asset);
  try {
    const response = await fetchImpl(url, {method: "GET", cache: "no-store", credentials: "omit", redirect: "error"});
    if (!response.ok) return unavailable(response.status === 404 ? "NO_OBSERVATION" : "HTTP_ERROR");
    const body = await response.json();
    if (body?.ok !== true || body.asset !== asset || body.ticker_id !== expected.tickerId || body.source_profile_code !== expected.sourceProfileCode || !body.timeframes || typeof body.timeframes !== "object") return unavailable("IDENTITY_MISMATCH");
    return {available: true, asset, tickerId: body.ticker_id, sourceProfileCode: body.source_profile_code, status: body.status, latestReceipt: body.latest_receipt ?? null, timeframes: body.timeframes};
  } catch { return unavailable("NETWORK_ERROR"); }
}
