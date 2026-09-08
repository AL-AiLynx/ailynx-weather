"use strict";

// This file deliberately contains no credential. Deployment supplies only the
// public publishable key through window.__AILYNX_SUPABASE_PUBLISHABLE_KEY__.
// When it is absent the application remains anonymous FREE.
window.AiLynxPublicRuntimeConfig = Object.freeze({
  supabaseUrl: "https://jggazwqwalincsjegieo.supabase.co",
  publishableKey: typeof window.__AILYNX_SUPABASE_PUBLISHABLE_KEY__ === "string"
    ? window.__AILYNX_SUPABASE_PUBLISHABLE_KEY__.trim()
    : "",
});
