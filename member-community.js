"use strict";

const memberConfig = window.AiLynxCommunityConfig;
const i18n = window.AiLynxI18n;
const communityClient = window.AiLynxCommunityClient;

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function showDialog(id) { document.getElementById(id)?.showModal(); }
function closeDialog(id) { document.getElementById(id)?.close(); }
function providerLabel(provider) { return `${i18n.t(`provider${provider[0].toUpperCase()}${provider.slice(1)}`)} · ${memberConfig.providers[provider].replace("_", " ")}`; }

function renderMemberState() {
  const enabled = communityClient.canUseCommunity();
  const profile = document.getElementById("memberProfile");
  if (profile) profile.hidden = false;
  setText("memberProfileLabel", enabled ? i18n.t("login") : `${i18n.t("login")} · ${i18n.t("setupRequired")}`);
  document.querySelectorAll("[data-community-auth]").forEach((element) => { element.disabled = true; element.title = i18n.t("setupRequired"); });
  setText("communityAvailability", enabled ? i18n.t("signInRequired") : i18n.t("setupRequired"));
  setText("planStatusChip", enabled ? i18n.t("free") : i18n.t("joinFree"));
}

function initializeLanguage() {
  document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => i18n.setLanguage(button.dataset.language)));
  i18n.applyTranslations();
}

function initializeAuthShell() {
  document.getElementById("manualButton")?.addEventListener("click", () => showDialog("manualDialog"));
  document.getElementById("memberProfile")?.addEventListener("click", () => showDialog("accountDialog"));
  document.querySelectorAll("[data-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      try { await communityClient.beginOAuth(button.dataset.provider); }
      catch { setText("authSetupNote", `${providerLabel(button.dataset.provider)} · ${i18n.t("setupRequired")}`); }
    });
  });
  document.querySelectorAll("[data-gate-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      window.AiLynxAuthGate?.startAuthentication();
      try { await communityClient.beginOAuth(button.dataset.gateProvider); }
      catch {
        window.AiLynxAuthGate?.logout();
        setText("authSetupNote", `${providerLabel(button.dataset.gateProvider)} · ${i18n.t("setupRequired")}`);
      }
    });
  });
  document.querySelectorAll("[data-onboarding-language]").forEach((button) => button.addEventListener("click", () => {
    i18n.setLanguage(button.dataset.onboardingLanguage);
    document.querySelectorAll("[data-onboarding-language]").forEach((item) => item.classList.toggle("is-active", item === button));
  }));
  document.querySelectorAll("[data-onboarding-asset]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-onboarding-asset]").forEach((item) => item.classList.toggle("is-active", item === button));
  }));
  document.querySelector("[data-onboarding-save]")?.addEventListener("click", () => {
    const mainAsset = document.querySelector("[data-onboarding-asset].is-active")?.dataset.onboardingAsset || "BTCUSD";
    window.AiLynxAuthGate?.completeOnboarding({language: i18n.language, mainAsset});
  });
  document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog")?.id)));
}

function initializeCommunityTabs() {
  document.querySelectorAll("[data-community-tab]").forEach((button) => button.addEventListener("click", () => {
    const selected = button.dataset.communityTab;
    document.querySelectorAll("[data-community-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-community-panel]").forEach((panel) => { panel.hidden = panel.dataset.communityPanel !== selected; });
  }));
}

function initializeShare() {
  document.querySelectorAll("[data-copy-referral]").forEach((button) => button.addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}?ref=SETUP_REQUIRED`;
    try { await navigator.clipboard.writeText(link); button.textContent = i18n.t("copy"); } catch { window.prompt("Copy", link); }
  }));
}

function initializeEmojiPicker() {
  const picker = document.getElementById("communityEmojiPicker");
  if (!picker) return;
  const nativeEmoji = ["😀", "👍", "👀", "🌤️"];
  for (const emoji of nativeEmoji) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.addEventListener("click", () => { const input = document.querySelector("[data-community-input]:not([hidden])"); if (input) input.value += emoji; }); picker.appendChild(button); }
  for (const emoji of memberConfig.emojiManifest) {
    if (!emoji?.id || !emoji?.path) continue;
    const button = document.createElement("button"); button.type = "button"; button.title = emoji.name || emoji.id; const image = document.createElement("img"); image.alt = `:${emoji.id}:`; image.src = emoji.path; button.appendChild(image); picker.appendChild(button);
  }
}

function initializeMemberCommunity() {
  if (!memberConfig || !i18n || !communityClient) return;
  initializeLanguage();
  initializeAuthShell();
  initializeCommunityTabs();
  initializeShare();
  initializeEmojiPicker();
  renderMemberState();
  window.addEventListener("ailynx-language", renderMemberState);
}

window.addEventListener("DOMContentLoaded", initializeMemberCommunity);
