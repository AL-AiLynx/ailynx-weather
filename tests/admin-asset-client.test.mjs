import test from "node:test";
import assert from "node:assert/strict";
import {AS1_ADMIN_ASSET_ENDPOINT, fetchAdminAssetObservations} from "../admin-asset-client.js";

const config = {publishableKey: "public-key"};
const session = {access_token: "admin-token"};

test("admin receipt reads require a session token and target only the admin endpoint", async () => {
  assert.deepEqual(await fetchAdminAssetObservations({asset: "XAUUSD", config}), {available: false, reason: "AUTH_REQUIRED"});
  let request;
  const result = await fetchAdminAssetObservations({
    asset: "XAUUSD",
    config,
    session,
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {ok: false, status: 403, json: async () => ({})};
    },
  });
  assert.equal(result.reason, "HTTP_ERROR");
  assert.equal(request.url.origin + request.url.pathname, AS1_ADMIN_ASSET_ENDPOINT);
  assert.equal(request.options.headers.Authorization, "Bearer admin-token");
  assert.equal(request.options.headers.apikey, "public-key");
  assert.equal(request.options.credentials, "omit");
});
