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
  const planLabel = (plan) => window.LynxDashboardConfig?.plans?.[plan]?.label || "플러스";
  const requestAssetAccess = (asset) => {
    if (!current.authenticated) { open(dialog); return "AUTH_REQUIRED"; }
    const requiredPlan = asset?.requiredPlan || "WEATHER";
    const label = planLabel(requiredPlan);
    const eyebrow = upgrade?.querySelector("#membershipUpgradeEyebrow");
    const title = upgrade?.querySelector("#membershipUpgradeTitle");
    const description = upgrade?.querySelector("#membershipUpgradeDescription");
    const planButton = upgrade?.querySelector("[data-open-plan]");
    if (eyebrow) eyebrow.textContent = `${label} 멤버십`;
    if (title) title.textContent = `${label}에서 추가 자산 날씨를 확인하세요`;
    if (description) description.textContent = "BTC 외 시장까지 같은 Lynx Weather 기준으로 관측할 수 있습니다.";
    if (planButton) planButton.dataset.planTarget = requiredPlan;
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
