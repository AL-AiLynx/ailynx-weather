import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("member/community MVP is disabled without public Auth configuration", async () => {
  const [config, client, i18n] = await Promise.all([read("community-config.js"), read("community-client.js"), read("i18n.js")]);
  assert.match(config, /enabled: false/);
  assert.match(config, /publishableKey: ""/);
  assert.match(config, /google: "SETUP_REQUIRED"/);
  assert.match(config, /chatgpt: "COMING_SOON"/);
  assert.doesNotMatch(config, /service_role/i);
  assert.match(client, /canUseCommunity/);
  assert.match(client, /beginOAuth/);
  assert.match(i18n, /localStorage/);
  assert.match(i18n, /ko:/);
  assert.match(i18n, /en:/);
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

test("community UI has separate posts/chat, provider states, and no upload control", async () => {
  const [html, ui] = await Promise.all([read("index.html"), read("member-community.js")]);
  assert.match(html, /data-community-tab="posts"/);
  assert.match(html, /data-community-tab="chat"/);
  assert.match(html, /data-provider="google"/);
  assert.match(html, /data-provider="kakao"/);
  assert.match(html, /data-provider="toss"/);
  assert.match(html, /data-provider="chatgpt"/);
  assert.doesNotMatch(html, /type="file"|<input[^>]+file/i);
  assert.match(ui, /emojiManifest/);
  assert.match(ui, /navigator\.clipboard/);
});
