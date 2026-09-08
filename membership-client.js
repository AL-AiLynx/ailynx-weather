"use strict";

// The sole membership source is subscriptions.plan_code; all other outcomes
// (anonymous, missing, inactive, or RLS/query failure) are FREE.
export const CANONICAL_PLAN_CODES = Object.freeze(["FREE", "WEATHER", "PRO", "PREMIUM"]);
export const canonicalPlan = (value) => CANONICAL_PLAN_CODES.includes(String(value || "").toUpperCase()) ? String(value).toUpperCase() : "FREE";
const active = (value) => String(value || "").toUpperCase() === "ACTIVE";

export async function subscriptionPlan({ config, session, fetchImpl = globalThis.fetch }) {
  if (!config?.supabaseUrl || !config?.publishableKey || !session?.access_token) return "FREE";
  try {
    const response = await fetchImpl(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/subscriptions?select=plan_code,status&limit=1`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return "FREE";
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows.find((candidate) => active(candidate?.status)) : null;
    return row ? canonicalPlan(row.plan_code) : "FREE";
  } catch { return "FREE"; }
}

export async function resolveMembership({ config = globalThis.window?.AiLynxCommunityConfig, authClient = globalThis.window?.AiLynxSupabaseAuth, fetchImpl } = {}) {
  try {
    const session = await authClient?.getSession?.();
    if (!session?.user) return { authenticated: false, user: null, plan: "FREE", source: "anonymous" };
    const plan = await subscriptionPlan({ config, session, fetchImpl });
    return { authenticated: true, user: session.user, plan, source: plan === "FREE" ? "fallback" : "subscription" };
  } catch { return { authenticated: false, user: null, plan: "FREE", source: "unavailable" }; }
}

let state = { authenticated: false, user: null, plan: "FREE", source: "boot" };
export const membership = () => state;
export async function refreshMembership() {
  state = await resolveMembership();
  window.dispatchEvent(new CustomEvent("ailynx-membership", { detail: state }));
  return state;
}

if (typeof window !== "undefined") {
  window.AiLynxMembership = Object.freeze({ canonicalPlan, membership, refresh: refreshMembership });
  window.addEventListener("ailynx-auth-session", () => { void refreshMembership(); });
  void refreshMembership();
}
