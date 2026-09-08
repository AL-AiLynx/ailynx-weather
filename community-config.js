"use strict";

// Public browser configuration only. Never add a service-role key or OAuth secret here.
window.AiLynxCommunityConfig = Object.freeze({
  enabled: false,
  supabaseUrl: "https://jggazwqwalincsjegieo.supabase.co",
  publishableKey: "",
  providers: Object.freeze({google: "SETUP_REQUIRED", kakao: "SETUP_REQUIRED", toss: "COMING_SOON", chatgpt: "COMING_SOON"}),
  socialLinks: Object.freeze({youtube: "", discord: "", telegram: ""}),
  emojiManifest: Object.freeze([]),
  xp: Object.freeze({post: 10, comment: 3, chat: 1, referral: 25}),
});
