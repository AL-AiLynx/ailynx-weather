"use strict";

(() => {
  const config = window.AiLynxCommunityConfig || {};
  let current = { authenticated: false, plan: "FREE" };
  const dialog = document.getElementById("authGateDialog");
  const upgrade = document.getElementById("membershipUpgradeDialog");
  const open = (node) => node?.showModal?.();
  const close = (node) => node?.close?.();
  const sync = async () => {
    current = await window.AiLynxMembership?.refresh?.() || { authenticated: false, plan: "FREE" };
    window.dispatchEvent(new CustomEvent("ailynx-auth-ready", { detail: current }));
    return current;
  };
  const requestAssetAccess = (asset) => {
    if (!current.authenticated) { open(dialog); return "AUTH_REQUIRED"; }
    const text = upgrade?.querySelector("[data-upgrade-asset]");
    if (text) text.textContent = asset?.label || asset?.id || "this asset";
    open(upgrade); return "UPGRADE_REQUIRED";
  };
  const signOut = async () => {
    await window.AiLynxSupabaseAuth?.signOut?.();
    current = { authenticated: false, plan: "FREE" };
    window.dispatchEvent(new CustomEvent("ailynx-auth-session"));
    window.dispatchEvent(new CustomEvent("ailynx-auth-logout"));
  };
  window.AiLynxAuthGate = Object.freeze({
    enabled: () => Boolean(config.authGateEnabled),
    canFetchLive: () => true,
    state: () => current,
    refresh: sync,
    requestAssetAccess,
    signOut,
    openLogin: () => open(dialog),
    close: () => { close(dialog); close(upgrade); },
  });
  window.addEventListener("ailynx-membership", (event) => { current = event.detail || current; });
  document.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-auth-action]")?.dataset.authAction;
    if (action === "close") window.AiLynxAuthGate.close();
  });
  void sync();
})();
