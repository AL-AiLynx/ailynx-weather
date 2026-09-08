import test from "node:test";
import assert from "node:assert/strict";
import { canonicalPlan, resolveMembership, subscriptionPlan } from "../membership-client.js";
import { publicAuthConfig } from "../auth-client.js";

test("unknown or inactive subscriptions are FREE", async () => {
  assert.equal(canonicalPlan("plus"), "FREE");
  const plan = await subscriptionPlan({ config: { supabaseUrl: "https://example.test", publishableKey: "public" }, session: { access_token: "token" }, fetchImpl: async () => ({ ok: true, json: async () => [{ plan_code: "WEATHER", status: "INACTIVE" }] }) });
  assert.equal(plan, "FREE");
});
test("authenticated active plan uses RLS-safe subscription read", async () => {
  const value = await resolveMembership({ config: { supabaseUrl: "https://example.test", publishableKey: "public" }, authClient: { getSession: async () => ({ access_token: "token", user: { id: "u1" } }) }, fetchImpl: async () => ({ ok: true, json: async () => [{ plan_code: "WEATHER", status: "ACTIVE" }] }) });
  assert.deepEqual(value, { authenticated: true, user: { id: "u1" }, plan: "WEATHER", source: "subscription" });
});
test("unavailable public config is anonymous FREE and contains no secret path", async () => {
  assert.deepEqual(publicAuthConfig({ supabaseUrl: "https://example.test", publishableKey: "" }), { url: "https://example.test", publishableKey: "", available: false });
  const value = await resolveMembership({ config: {}, authClient: { getSession: async () => null } });
  assert.equal(value.plan, "FREE");
  assert.equal(value.authenticated, false);
});
