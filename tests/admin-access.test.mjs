import test from "node:test";
import assert from "node:assert/strict";
import {hasAdminFullAccess, isAdminMembership, isCurrentUserAdmin} from "../admin-access.js";

const config = {supabaseUrl: "https://project.supabase.co", publishableKey: "public-key"};
const session = {access_token: "member-token"};

test("admin display entry accepts only a server-verified current-session RPC result", async () => {
  const calls = [];
  const verified = await isCurrentUserAdmin({
    config,
    session,
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {ok: true, json: async () => true};
    },
  });
  assert.equal(verified, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://project.supabase.co/rest/v1/rpc/is_current_user_admin");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body, "{}");
  assert.equal(calls[0].options.headers.Authorization, "Bearer member-token");
  assert.equal(isAdminMembership({authenticated: true}, verified), true);
  assert.equal(isAdminMembership({authenticated: false}, verified), false);
  assert.equal(hasAdminFullAccess(verified), true);
});

test("anonymous, failed, or false admin RPC results fail closed", async () => {
  let calls = 0;
  assert.equal(await isCurrentUserAdmin({config, fetchImpl: async () => { calls += 1; return {ok: true, json: async () => true};}}), false);
  assert.equal(calls, 0);
  assert.equal(await isCurrentUserAdmin({config, session, fetchImpl: async () => ({ok: true, json: async () => false})}), false);
  assert.equal(await isCurrentUserAdmin({config, session, fetchImpl: async () => ({ok: false, json: async () => ({})})}), false);
  assert.equal(isAdminMembership({authenticated: true}, false), false);
  assert.equal(hasAdminFullAccess(false), false);
});
