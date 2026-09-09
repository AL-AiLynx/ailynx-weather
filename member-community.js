"use strict";

const memberConfig = window.AiLynxCommunityConfig;
const i18n = window.AiLynxI18n;
const communityClient = window.AiLynxCommunityClient;

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function showDialog(id) { document.getElementById(id)?.showModal(); }
function closeDialog(id) { document.getElementById(id)?.close(); }
function providerLabel(provider) { return `${i18n.t(`provider${provider[0].toUpperCase()}${provider.slice(1)}`)} · ${memberConfig.providers[provider].replace("_", " ")}`; }
function planDisplayName(plan) { return window.LynxDashboardConfig?.plans?.[plan]?.label || "무료"; }
function adminMembership(state) { return window.AiLynxAdminAccess?.isAdminMembership?.(state) ?? false; }

function renderAdminShell(state) {
  const isAdmin = adminMembership(state);
  document.getElementById("adminEntry")?.remove();
  document.getElementById("accountAdminBadge")?.remove();
  if (!isAdmin) return;
  const controls = document.querySelector(".member-controls");
  const entry = document.createElement("button");
  entry.id = "adminEntry";
  entry.className = "admin-entry";
  entry.type = "button";
  entry.innerHTML = '<span aria-hidden="true">◆</span> 관리자';
  entry.addEventListener("click", () => window.location.assign("/admin"));
  controls?.insertBefore(entry, document.getElementById("memberProfile"));
  const badge = document.createElement("span");
  badge.id = "accountAdminBadge";
  badge.className = "account-admin-badge";
  badge.textContent = "◆ 관리자";
  document.getElementById("accountAuthenticated")?.prepend(badge);
}

function renderMemberState(state = window.AiLynxMembership?.membership?.() || {authenticated: false, plan: "FREE"}) {
  const enabled = communityClient.canUseCommunity();
  const plan = String(state.plan || "FREE").toUpperCase();
  const profile = document.getElementById("memberProfile");
  if (profile) profile.hidden = false;
  setText("memberProfileLabel", enabled ? i18n.t("login") : `${i18n.t("login")} · ${i18n.t("setupRequired")}`);
  document.querySelectorAll("[data-community-auth]").forEach((element) => { element.disabled = true; element.title = i18n.t("setupRequired"); });
  setText("communityAvailability", enabled ? i18n.t("signInRequired") : i18n.t("setupRequired"));
  setText("planStatusChip", planDisplayName(plan));
  setText("accountPlanValue", planDisplayName(plan));
  renderAdminShell(state);
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

function initializePlanDialog() {
  const dialog = document.getElementById("planDialog");
  if (!dialog) return;
  const open = (trigger) => {
    const plan = String(trigger?.dataset.planTarget || "").toUpperCase();
    const card = dialog.querySelector(`[data-plan-card="${plan}"]`);
    dialog.querySelectorAll("[data-plan-card]").forEach((item) => item.classList.toggle("is-highlighted", item === card));
    const intro = document.getElementById("planDialogIntro");
    if (intro) intro.textContent = plan ? `${planDisplayName(plan)} 플랜에서 제공되는 관측 범위를 확인하세요.` : "현재 관측 범위에 맞는 플랜을 확인하세요.";
    const sourceDialog = trigger?.closest?.("dialog");
    if (sourceDialog && sourceDialog !== dialog) sourceDialog.close();
    dialog.showModal();
  };
  document.addEventListener("click", (event) => {
    const opener = event.target.closest?.("[data-open-plan]");
    if (!opener) return;
    event.preventDefault();
    open(opener);
  });
  dialog.querySelectorAll("[data-plan-interest]").forEach((button) => button.addEventListener("click", () => {
    const plan = planDisplayName(button.dataset.planInterest);
    const notice = document.getElementById("planDialogNotice");
    if (notice) notice.textContent = `${plan} 구독을 준비 중입니다.`;
  }));
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
  initializePlanDialog();
  renderMemberState();
  window.addEventListener("ailynx-language", renderMemberState);
  window.addEventListener("ailynx-membership", (event) => renderMemberState(event.detail));
  window.addEventListener("ailynx-admin", () => renderMemberState());
}

window.addEventListener("DOMContentLoaded", initializeMemberCommunity);



// C-4 account UX: one visible step at a time and a strict anonymous/member split.
(() => {
  const byId = (id) => document.getElementById(id);
  const account = () => byId("accountDialog");
  const membership = () => window.AiLynxMembership?.membership?.() || {authenticated: false, user: null, plan: "FREE"};
  const note = (message, error = false) => {
    const target = byId("authSetupNote");
    if (!target) return;
    target.textContent = message;
    target.toggleAttribute("data-auth-error", error);
  };
  const redirect = (path) => `${window.location.origin}${path}`;
  const clearPasswords = () => document.querySelectorAll("[data-auth-password]").forEach((field) => { field.value = ""; });
  const showView = (view = "login") => {
    document.querySelectorAll("[data-auth-panel]").forEach((panel) => { panel.hidden = panel.dataset.authPanel !== view; });
    document.querySelectorAll("[data-auth-view]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.authView === view)));
  };
  const renderAccount = (state = membership()) => {
    const authenticated = Boolean(state.authenticated);
    byId("accountAnonymous")?.toggleAttribute("hidden", authenticated);
    byId("accountAuthenticated")?.toggleAttribute("hidden", !authenticated);
    const profile = byId("memberProfile");
    if (profile) profile.hidden = false;
    const email = state.user?.email || "";
    const label = authenticated ? email : "로그인 / 무료 회원가입";
    const profileLabel = byId("memberProfileLabel");
    if (profileLabel) profileLabel.textContent = label;
    const userEmail = byId("accountUserEmail");
    if (userEmail) userEmail.textContent = email;
    const plan = String(state.plan || "FREE").toUpperCase();
    const displayPlan = planDisplayName(plan);
    byId("accountPlanValue") && (byId("accountPlanValue").textContent = displayPlan);
    byId("planStatusChip") && (byId("planStatusChip").textContent = displayPlan);
    renderAdminShell(state);
    byId("accountUpgradeNote")?.toggleAttribute("hidden", !authenticated || plan !== "FREE");
    byId("accountPlanButton")?.toggleAttribute("hidden", !authenticated || plan !== "FREE");
    if (!authenticated) showView("login");
  };
  const closeAccount = () => account()?.close?.();
  const openAccount = (event) => { renderAccount(); account()?.showModal?.(); showView(event?.currentTarget?.dataset.authOpen || "login"); };
  const login = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await window.AiLynxSupabaseAuth.signIn({email: form.email.value.trim(), password: form.password.value});
      clearPasswords();
      await window.AiLynxAuthGate.refresh();
      note("로그인되었습니다.");
      closeAccount();
    } catch { note("로그인할 수 없습니다. 이메일과 비밀번호를 확인하세요.", true); }
  };
  const signup = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.password.value !== form.passwordConfirm.value) return note("비밀번호 확인이 일치하지 않습니다.", true);
    try {
      const result = await window.AiLynxSupabaseAuth.signUp({email: form.email.value.trim(), password: form.password.value, redirectTo: redirect("/auth/callback")});
      clearPasswords();
      if (result.confirmationRequired) {
        showView("login");
        note("확인 이메일을 보냈습니다. 이메일의 링크를 연 뒤 로그인하세요.");
      } else {
        await window.AiLynxAuthGate.refresh();
        note("무료 회원가입이 완료되었습니다.");
        closeAccount();
      }
    } catch { note("회원가입을 완료할 수 없습니다. 잠시 후 다시 시도하세요.", true); }
  };
  const reset = async (event) => {
    event.preventDefault();
    try {
      await window.AiLynxSupabaseAuth.resetPasswordForEmail(event.currentTarget.email.value.trim(), redirect("/auth/reset"));
      note("등록된 이메일이라면 비밀번호 재설정 안내를 보냈습니다.");
    } catch { note("비밀번호 재설정을 요청할 수 없습니다. 잠시 후 다시 시도하세요.", true); }
  };
  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-open-account], [data-auth-open]").forEach((button) => button.addEventListener("click", openAccount));
    document.querySelectorAll("[data-auth-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.authView)));
    byId("emailLoginForm")?.addEventListener("submit", login);
    byId("emailSignupForm")?.addEventListener("submit", signup);
    byId("passwordResetForm")?.addEventListener("submit", reset);
    byId("accountLogout")?.addEventListener("click", async () => {
      await window.AiLynxAuthGate.signOut();
      clearPasswords();
      renderAccount({authenticated: false, user: null, plan: "FREE"});
      note("로그아웃되었습니다.");
      closeAccount();
    });
    window.addEventListener("ailynx-membership", (event) => renderAccount(event.detail));
    renderAccount();
  });
})();
