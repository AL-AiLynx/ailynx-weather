import assert from "node:assert/strict";
import test from "node:test";
import {CANONICAL_PLAN_CODES, canonicalPlan, readAccessToken, resolveMembership, subscriptionPlan} from "../membership-client.js";

const config = Object.freeze({supabaseUrl: "https://jggazwqwalincsjegieo.supabase.co", publishableKey: "public-anon-key"});
const storageWith = (value) => ({getItem: (key) => key === "sb-jggazwqwalincsjegieo-auth-token" ? value : null});

test("only Production canonical plan codes are accepted", () => {
  assert.deepEqual(CANONICAL_PLAN_CODES, ["FREE", "WEATHER", "PRO", "PREMIUM"]);
  assert.equal(canonicalPlan("WEATHER"), "WEATHER");
  assert.equal(canonicalPlan("PLUS"), "FREE");
  assert.equal(subscriptionPlan([{plan_code: "PREMIUM", status: "ACTIVE"}]), "PREMIUM");
  assert.equal(subscriptionPlan([{plan_code: "PRO", status: "PAST_DUE"}]), "FREE");
});

test("the resolver reads only the authenticated user's RLS-protected subscription row", async () => {
  const token = JSON.stringify({access_token: "session-token"});
  const calls = [];
  const state = await resolveMembership({
    config,
    storage: storageWith(token),
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {ok: true, json: async () => [{plan_code: "WEATHER", status: "ACTIVE"}]};
    },
  });
  assert.equal(state.plan, "WEATHER");
  assert.equal(state.authenticated, true);
  assert.equal(state.source, "subscriptions.plan_code");
  assert.match(calls[0].url, /subscriptions\?select=plan_code%2Cstatus&limit=1/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer session-token");
  assert.equal(calls[0].options.credentials, "omit");
});

test("missing session, configuration, or a failed subscription read fail closed to FREE", async () => {
  assert.equal(readAccessToken({storage: storageWith("not json"), projectRef: "jggazwqwalincsjegieo"}), null);
  assert.equal((await resolveMembership({config, storage: storageWith(null)})).plan, "FREE");
  assert.equal((await resolveMembership({config: {...config, publishableKey: ""}, storage: storageWith(JSON.stringify({access_token: "token"}))})).plan, "FREE");
  assert.equal((await resolveMembership({config, storage: storageWith(JSON.stringify({access_token: "token"})), fetchImpl: async () => ({ok: false})})).plan, "FREE");
});
