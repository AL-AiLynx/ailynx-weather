import assert from "node:assert/strict";
import test from "node:test";
import {CANONICAL_PLAN_CODES, canonicalPlan, resolveMembership, subscriptionPlan} from "../membership-client.js";

const config = Object.freeze({supabaseUrl: "https://jggazwqwalincsjegieo.supabase.co", publishableKey: "public-anon-key"});
test("only Production canonical plan codes are accepted", async () => {
  assert.deepEqual(CANONICAL_PLAN_CODES, ["FREE", "WEATHER", "PRO", "PREMIUM"]);
  assert.equal(canonicalPlan("WEATHER"), "WEATHER");
  assert.equal(canonicalPlan("PLUS"), "FREE");
  const session = {access_token: "session-token", user: {id: "user-1"}};
  assert.equal(await subscriptionPlan({config, session, fetchImpl: async () => ({ok: true, json: async () => [{plan_code: "PREMIUM", status: "ACTIVE"}]})}), "PREMIUM");
  assert.equal(await subscriptionPlan({config, session, fetchImpl: async () => ({ok: true, json: async () => [{plan_code: "PRO", status: "PAST_DUE"}]})}), "FREE");
});

test("the resolver reads only the authenticated user's RLS-protected subscription row", async () => {
  const calls = [];
  const state = await resolveMembership({
    config,
    authClient: {getSession: async () => ({access_token: "session-token", user: {id: "user-1"}})},
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {ok: true, json: async () => [{plan_code: "WEATHER", status: "ACTIVE"}]};
    },
  });
  assert.equal(state.plan, "WEATHER");
  assert.equal(state.authenticated, true);
  assert.equal(state.source, "subscription");
  assert.match(calls[0].url, /subscriptions\?select=plan_code,status&limit=1/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer session-token");
});

test("missing session, configuration, or a failed subscription read fail closed to FREE", async () => {
  const session = {access_token: "session-token", user: {id: "user-1"}};
  assert.equal((await resolveMembership({config})).plan, "FREE");
  assert.equal((await resolveMembership({config: {...config, publishableKey: ""}, authClient: {getSession: async () => session}})).plan, "FREE");
  assert.equal((await resolveMembership({config, authClient: {getSession: async () => session}, fetchImpl: async () => ({ok: false})})).plan, "FREE");
});
