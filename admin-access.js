"use strict";

// This is intentionally a display-entry guard, not an authorization system.
// Any future privileged action must still be authorized by server-side RLS/RPC.
export function isAdminUser(user, config = globalThis.window?.AiLynxCommunityConfig) {
  const userId = String(user?.id || "").trim();
  const allowlist = Array.isArray(config?.adminUserIds) ? config.adminUserIds : [];
  return Boolean(userId && allowlist.includes(userId));
}

export function isAdminMembership(state, config = globalThis.window?.AiLynxCommunityConfig) {
  return Boolean(state?.authenticated && isAdminUser(state?.user, config));
}

if (typeof window !== "undefined") {
  window.AiLynxAdminAccess = Object.freeze({isAdminUser, isAdminMembership});
}
