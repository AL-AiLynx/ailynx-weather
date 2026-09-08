const PLAN_CODES = Object.freeze(["FREE", "WEATHER", "PRO", "PREMIUM"]);
const ACTIVE_SUBSCRIPTION_STATUS = "ACTIVE";

export const CANONICAL_PLAN_CODES = PLAN_CODES;

export function canonicalPlan(value) {
  return typeof value === "string" && PLAN_CODES.includes(value) ? value : "FREE";
}

export function readAccessToken({storage, projectRef} = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof projectRef !== "string" || !projectRef) return null;
  let raw;
  try {
    raw = storage.getItem(`sb-${projectRef}-auth-token`);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function subscriptionPlan(rows) {
  if (!Array.isArray(rows) || rows.length !== 1) return "FREE";
  const [subscription] = rows;
  if (!subscription || subscription.status !== ACTIVE_SUBSCRIPTION_STATUS) return "FREE";
  return canonicalPlan(subscription.plan_code);
}

function projectRefFromUrl(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export async function resolveMembership({config, storage = globalThis.localStorage, fetchImpl = globalThis.fetch} = {}) {
  const supabaseUrl = typeof config?.supabaseUrl === "string" ? config.supabaseUrl : "";
  const publishableKey = typeof config?.publishableKey === "string" ? config.publishableKey : "";
  const projectRef = projectRefFromUrl(supabaseUrl);
  const accessToken = readAccessToken({storage, projectRef});
  const base = Object.freeze({plan: "FREE", authenticated: Boolean(accessToken), source: "subscriptions.plan_code"});

  if (!accessToken) return Object.freeze({...base, reason: "ANONYMOUS"});
  if (!supabaseUrl || !publishableKey || typeof fetchImpl !== "function") return Object.freeze({...base, reason: "CONFIG_UNAVAILABLE"});

  const endpoint = new URL("/rest/v1/subscriptions", supabaseUrl);
  endpoint.searchParams.set("select", "plan_code,status");
  endpoint.searchParams.set("limit", "1");
  try {
    const response = await fetchImpl(endpoint.toString(), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      headers: {apikey: publishableKey, Authorization: `Bearer ${accessToken}`, Accept: "application/json"},
    });
    if (!response?.ok) return Object.freeze({...base, reason: "SUBSCRIPTION_UNAVAILABLE"});
    const rows = await response.json();
    return Object.freeze({...base, plan: subscriptionPlan(rows), reason: "SUBSCRIPTION_RESOLVED"});
  } catch {
    return Object.freeze({...base, reason: "SUBSCRIPTION_UNAVAILABLE"});
  }
}

function browserMembership() {
  let state = Object.freeze({plan: "FREE", authenticated: false, source: "subscriptions.plan_code", reason: "BOOTING"});
  const publish = () => window.dispatchEvent(new CustomEvent("ailynx-membership", {detail: state}));
  const refresh = async () => {
    state = await resolveMembership({config: window.AiLynxCommunityConfig});
    publish();
    return state;
  };
  return Object.freeze({
    get plan() { return state.plan; },
    get authenticated() { return state.authenticated; },
    get state() { return state; },
    refresh,
  });
}

if (typeof window !== "undefined") {
  window.AiLynxMembership = browserMembership();
  const boot = () => void window.AiLynxMembership.refresh();
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot, {once: true});
  else boot();
}
