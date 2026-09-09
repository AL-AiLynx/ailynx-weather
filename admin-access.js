"use strict";

const rpcUrlFor = (config) => `${String(config?.supabaseUrl || "").replace(/\/$/, "")}/rest/v1/rpc/is_current_user_admin`;
let current = false;

export async function isCurrentUserAdmin({config = globalThis.window?.AiLynxCommunityConfig, session, fetchImpl = globalThis.fetch} = {}) {
  if (!config?.supabaseUrl || !config?.publishableKey || !session?.access_token || typeof fetchImpl !== "function") return false;
  try {
    const response = await fetchImpl(rpcUrlFor(config), {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    return response.ok && (await response.json().catch(() => false)) === true;
  } catch {
    return false;
  }
}

export function isAdminMembership(state, verified = current) {
  return Boolean(state?.authenticated && verified === true);
}

export const adminState = () => Object.freeze({verified: current});

export async function refreshAdminAccess({config = globalThis.window?.AiLynxCommunityConfig, authClient = globalThis.window?.AiLynxSupabaseAuth, fetchImpl} = {}) {
  const session = await authClient?.getSession?.().catch(() => null);
  current = await isCurrentUserAdmin({config, session, fetchImpl});
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ailynx-admin", {detail: adminState()}));
  return current;
}

if (typeof window !== "undefined") {
  window.AiLynxAdminAccess = Object.freeze({isCurrentUserAdmin, isAdminMembership, adminState, refresh: refreshAdminAccess});
  window.addEventListener("ailynx-membership", () => { void refreshAdminAccess(); });
  window.addEventListener("ailynx-auth-logout", () => {
    current = false;
    window.dispatchEvent(new CustomEvent("ailynx-admin", {detail: adminState()}));
  });
  void refreshAdminAccess();
}
