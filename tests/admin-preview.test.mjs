import test from "node:test";
import assert from "node:assert/strict";
import {effectivePlan, hasAdminFullPreview, previewState, previewUrl, refreshAdminPreview} from "../admin-preview.js";

const config = {supabaseUrl: "https://project.supabase.co", publishableKey: "public-key"};
const session = {access_token: "admin-token", user: {id: "admin-id"}};
const adminClient = {getSession: async () => session};
const locationFor = (mode) => ({href: `https://weather.example/?adminPreview=${mode}`});

test("a server-verified admin can simulate only the canonical preview modes", async () => {
  await refreshAdminPreview({
    config,
    authClient: adminClient,
    locationRef: locationFor("PREMIUM"),
    fetchImpl: async () => ({ok: true, json: async () => true}),
  });
  assert.deepEqual(previewState(), {verified: true, mode: "PREMIUM"});
  assert.equal(effectivePlan("FREE"), "PREMIUM");
  assert.equal(hasAdminFullPreview(), false);
  assert.equal(previewUrl("ADMIN", locationFor("FREE")), "/?adminPreview=ADMIN");
  await refreshAdminPreview({
    config,
    authClient: adminClient,
    locationRef: locationFor("ADMIN"),
    fetchImpl: async () => ({ok: true, json: async () => true}),
  });
  assert.equal(effectivePlan("FREE"), "PRO");
  assert.equal(hasAdminFullPreview(), true);
});

test("a forged preview query fails closed and cannot change the subscription plan", async () => {
  await refreshAdminPreview({
    config,
    authClient: adminClient,
    locationRef: locationFor("PRO"),
    fetchImpl: async () => ({ok: true, json: async () => false}),
  });
  assert.deepEqual(previewState(), {verified: false, mode: null});
  assert.equal(effectivePlan("WEATHER"), "WEATHER");
  await refreshAdminPreview({config, authClient: adminClient, locationRef: locationFor("NOT_A_PLAN")});
  assert.deepEqual(previewState(), {verified: false, mode: null});
});
