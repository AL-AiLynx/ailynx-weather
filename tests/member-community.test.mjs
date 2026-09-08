import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("membership runtime uses public Auth configuration with anonymous FREE fallback", async () => {
  const [config, runtime, authClient, client, i18n, gate, dashboard, admin] = await Promise.all([read("community-config.js"), read("public-runtime-config.js"), read("auth-client.js"), read("community-client.js"), read("i18n.js"), read("auth-gate.js"), read("lynx-dashboard-config.js"), read("admin-access.js")]);
  assert.match(config, /enabled: false/);
  assert.match(config, /authGateEnabled: true/);
  assert.match(runtime, /__AILYNX_SUPABASE_PUBLISHABLE_KEY__/);
  assert.match(authClient, /AUTH_UNAVAILABLE/);
  assert.match(authClient, /\/auth\/v1\/signup/);
  assert.match(authClient, /\/auth\/v1\/recover/);
  assert.match(config, /google: "DISABLED"/);
  assert.match(config, /chatgpt: "COMING_SOON"/);
  assert.match(config, /profilePersistenceAvailable: true/);
  assert.match(config, /adminUserIds: Object\.freeze\(\[\]\)/);
  assert.doesNotMatch(config, /service_role/i);
  assert.match(client, /canUseCommunity/);
  assert.match(client, /beginOAuth/);
  assert.match(i18n, /localStorage/);
  assert.match(i18n, /ko:/);
  assert.match(i18n, /en:/);
  assert.match(i18n, /const preferred = \(\) => "en"/);
  assert.match(i18n, /weatherDurability/);
  assert.match(i18n, /marketAdvisory/);
  assert.match(gate, /requestAssetAccess/);
  assert.match(gate, /ailynx-auth-logout/);
  assert.match(gate, /canFetchLive/);
  assert.match(dashboard, /assets: \["BTCUSD"\]/);
  assert.match(dashboard, /label: "플러스"/);
  assert.match(admin, /isAdminMembership/);
  assert.doesNotMatch(admin, /service_role/i);
  assert.doesNotMatch(dashboard, /activePlan|PLUS/);
});

test("community migration enforces RLS, text-only content, and referral/Xp invariants", async () => {
  const sql = await read("supabase/migrations/20260908113000_create_member_community.sql");
  for (const table of ["profiles", "community_posts", "community_comments", "chat_messages", "community_xp_events"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(sql, /SELF_REFERRAL_REJECTED/);
  assert.match(sql, /unique \(referrer_id, referred_user_id\)|referred_user_id uuid not null unique/i);
  assert.match(sql, /CHAT_RATE_LIMITED/);
  assert.match(sql, /COMMUNITY_URL_SPAM_REJECTED/);
  assert.match(sql, /unique \(user_id, event_type, source_kind, source_id\)/);
  assert.doesNotMatch(sql, /storage\.objects|create bucket|attachment/i);
});

test("community UI retains posts/chat and adds email Auth controls without upload", async () => {
  const [html, ui, advisory] = await Promise.all([read("index.html"), read("member-community.js"), read("market-advisory-config.js")]);
  assert.match(html, /data-community-tab="posts"/);
  assert.match(html, /data-community-tab="chat"/);
  assert.match(html, /emailLoginForm/);
  assert.match(html, /emailSignupForm/);
  assert.match(html, /passwordResetForm/);
  assert.doesNotMatch(html, /type="file"|<input[^>]+file/i);
  assert.match(ui, /emojiManifest/);
  assert.match(ui, /resetPasswordForEmail/);
  assert.match(ui, /navigator\.clipboard/);
  assert.match(html, /authGateDialog/);
  assert.match(html, /onboardingDialog/);
  assert.match(html, /JOIN FREE/);
  assert.match(html, /MARKET ADVISORY/);
  assert.match(html, /manualButton/);
  assert.match(html, /manualDialog/);
  assert.match(html, /adminEntry/);
  assert.match(html, /adminDialog/);
  assert.match(ui, /AiLynxAdminAccess/);
  assert.match(advisory, /active: null/);
  assert.match(advisory, /evidencePlan: "PRO"/);
});
