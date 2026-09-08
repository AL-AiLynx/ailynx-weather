"use strict";

const config = window.AiLynxCommunityConfig;
let state = "BOOTING";
let memberId = null;
const enabled = Boolean(config?.authGateEnabled && window.AiLynxCommunityClient?.canUseCommunity?.());

function canFetchLive() { return !enabled || state === "AUTHENTICATED"; }
function render() {
  document.body.dataset.authGate = enabled ? state.toLowerCase() : "ready-but-disabled";
  document.body.classList.toggle("auth-gate-active", enabled && state === "UNAUTHENTICATED");
  const gate = document.getElementById("authGateDialog");
  if (!enabled || !gate) return;
  if (state === "UNAUTHENTICATED" && !gate.open) gate.showModal();
}
function boot() {
  if (!enabled) { state = "AUTHENTICATED"; render(); return; }
  state = "UNAUTHENTICATED";
  window.setTimeout(render, Math.max(1000, Math.min(config.authGateDelayMs || 1500, 2000)));
}
function logout() { if (!enabled) return; state = "UNAUTHENTICATED"; render(); }
function startAuthentication() { if (!enabled) return; state = "AUTHENTICATING"; render(); }
function startOnboarding(nextMemberId) {
  if (!enabled) return;
  memberId = typeof nextMemberId === "string" ? nextMemberId : null;
  state = "ONBOARDING";
  document.getElementById("authGateDialog")?.close();
  document.getElementById("onboardingDialog")?.showModal();
  render();
}
function completeAuthentication(nextMemberId) { startOnboarding(nextMemberId); }
function completeOnboarding(preferences) {
  if (!enabled || !memberId || !preferences) return;
  // The backend profile wins when it is available. This is only a per-member temporary fallback.
  if (!config.profilePersistenceAvailable) localStorage.setItem(`ailynx-member-preferences:${memberId}`, JSON.stringify(preferences));
  state = "AUTHENTICATED";
  document.getElementById("onboardingDialog")?.close();
  window.dispatchEvent(new CustomEvent("ailynx-member-preferences", {detail: preferences}));
  render();
}
window.AiLynxAuthGate = Object.freeze({get state() { return state; }, get memberId() { return memberId; }, enabled, canFetchLive, boot, logout, startAuthentication, startOnboarding, completeAuthentication, completeOnboarding});
window.addEventListener("DOMContentLoaded", boot);
