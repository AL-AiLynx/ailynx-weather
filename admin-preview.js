"use strict";

import {isCurrentUserAdmin} from "./admin-access.js?v=2";

export const ADMIN_PREVIEW_MODES = Object.freeze(["FREE", "WEATHER", "PREMIUM", "PRO", "ADMIN"]);
let state = Object.freeze({verified: false, mode: null});

const requestedMode = (locationRef = globalThis.location) => {
  try {
    const value = new URL(locationRef?.href || "", globalThis.location?.origin).searchParams.get("adminPreview");
    return ADMIN_PREVIEW_MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
};

const publish = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ailynx-admin-preview", {detail: state}));
  return state;
};

export const previewState = () => state;
export const effectivePlan = (subscriptionPlan = "FREE") => state.verified && state.mode
  ? state.mode === "ADMIN" ? "PRO" : state.mode
  : subscriptionPlan;
export const hasAdminFullPreview = () => state.verified && state.mode === "ADMIN";

export async function refreshAdminPreview({
  config = globalThis.window?.AiLynxCommunityConfig,
  authClient = globalThis.window?.AiLynxSupabaseAuth,
  locationRef = globalThis.location,
  fetchImpl,
} = {}) {
  const mode = requestedMode(locationRef);
  if (!mode) {
    state = Object.freeze({verified: false, mode: null});
    return publish();
  }
  let session = null;
  try { session = await authClient?.getSession?.(); } catch { session = null; }
  const verified = await isCurrentUserAdmin({config, session, fetchImpl});
  state = Object.freeze({verified, mode: verified ? mode : null});
  return publish();
}

export const previewUrl = (mode, locationRef = globalThis.location) => {
  if (!ADMIN_PREVIEW_MODES.includes(mode)) return "/admin";
  const url = new URL(locationRef?.href || "/", globalThis.location?.origin);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("adminPreview", mode);
  return `${url.pathname}${url.search}`;
};

if (typeof window !== "undefined") {
  window.AiLynxAdminPreview = Object.freeze({
    modes: ADMIN_PREVIEW_MODES,
    previewState,
    effectivePlan,
    hasAdminFullPreview,
    refresh: refreshAdminPreview,
    previewUrl,
  });
  void refreshAdminPreview();
  window.addEventListener("ailynx-auth-logout", () => {
    state = Object.freeze({verified: false, mode: null});
    publish();
  });
}
