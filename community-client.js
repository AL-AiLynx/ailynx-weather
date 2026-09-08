"use strict";

const config = window.AiLynxCommunityConfig;
const unavailable = (reason = "SETUP_REQUIRED") => Promise.reject(new Error(reason));
function canUseCommunity() { return Boolean(config?.enabled && config.supabaseUrl && config.publishableKey); }
function authorizationHeaders(token, json = false) {
  return {apikey: config.publishableKey, Authorization: `Bearer ${token}`, ...(json ? {"Content-Type": "application/json"} : {})};
}
async function request(path, token, options = {}) {
  if (!canUseCommunity() || !token) throw new Error("AUTH_REQUIRED");
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {...options, headers: {...authorizationHeaders(token, Boolean(options.body)), ...options.headers}});
  if (!response.ok) throw new Error(`COMMUNITY_HTTP_${response.status}`);
  return response.status === 204 ? null : response.json();
}
function beginOAuth(provider) {
  if (!canUseCommunity() || config.providers?.[provider] !== "AVAILABLE") return unavailable(config.providers?.[provider] || "SETUP_REQUIRED");
  const url = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", window.location.origin + window.location.pathname);
  window.location.assign(url);
}
window.AiLynxCommunityClient = Object.freeze({canUseCommunity, beginOAuth, request});
