"use strict";

import {fetchAssetObservations} from "./as1-asset-client.js?v=2";

export const AS1_ADMIN_ASSET_ENDPOINT = "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-admin-asset-read";
const unavailable = (reason) => ({available: false, reason});

export async function fetchAdminAssetObservations({asset, config, session, fetchImpl = globalThis.fetch, signal} = {}) {
  if (!config?.publishableKey || !session?.access_token) return unavailable("AUTH_REQUIRED");
  return fetchAssetObservations({
    asset,
    fetchImpl,
    signal,
    endpoint: AS1_ADMIN_ASSET_ENDPOINT,
    headers: {apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}`},
  });
}
