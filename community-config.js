"use strict";

// Public browser configuration only. Never add a service-role key, database
// password, OAuth secret, or token here. An absent publishable key is valid:
// the application deliberately remains anonymous FREE until deployment config
// supplies the public key.
const runtime = window.AiLynxPublicRuntimeConfig || {};
window.AiLynxCommunityConfig = Object.freeze({
  enabled: false,
  authGateReadyButDisabled: false,
  authGateEnabled: true,
  authGateDelayMs: 0,
  profilePersistenceAvailable: true,
  supabaseUrl: String(runtime.supabaseUrl || "https://jggazwqwalincsjegieo.supabase.co").replace(/\/$/, ""),
  publishableKey: String(runtime.publishableKey || "").trim(),
  providers: Object.freeze({google: "DISABLED", kakao: "DISABLED", toss: "COMING_SOON", chatgpt: "COMING_SOON"}),
  socialLinks: Object.freeze({youtube: "", discord: "", telegram: ""}),
  emojiManifest: Object.freeze([]),
  xp: Object.freeze({post: 10, comment: 3, chat: 1, referral: 25}),
});
