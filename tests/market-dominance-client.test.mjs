import assert from "node:assert/strict";
import test from "node:test";

const client = await import(new URL("../market-dominance-client.js", import.meta.url));

function responseBody() {
  return {
    data: {
      updated_at: 1_788_825_463,
      market_cap_percentage: {btc: 59.1, usdt: 6.8, usdc: 2.7},
    },
  };
}

test("market dominance client normalizes BTC, USDT, and USDC from one public snapshot", () => {
  const result = client.validateMarketDominanceResponse(responseBody());
  assert.equal(result.available, true);
  assert.deepEqual(result.values, [
    {key: "btc", label: "BTC.D", value: 59.1},
    {key: "usdt", label: "USDT.D", value: 6.8},
    {key: "usdc", label: "USDC.D", value: 2.7},
  ]);
});

test("market dominance client rejects missing or invalid percentages", () => {
  const invalid = responseBody();
  invalid.data.market_cap_percentage.usdc = 101;
  assert.deepEqual(client.validateMarketDominanceResponse(invalid), {available: false, reason: "INVALID_DOMINANCE"});
});

test("market dominance fetch is credential-free and reports request failures", async () => {
  let captured;
  const success = await client.fetchMarketDominance({
    fetchImpl: async (url, init) => {
      captured = {url, init};
      return new Response(JSON.stringify(responseBody()), {status: 200});
    },
  });
  assert.equal(success.available, true);
  assert.equal(captured.url, client.COINGECKO_GLOBAL_ENDPOINT);
  assert.equal(captured.init.credentials, "omit");
  assert.equal(captured.init.cache, "no-store");

  const failure = await client.fetchMarketDominance({fetchImpl: async () => new Response("", {status: 503})});
  assert.deepEqual(failure, {available: false, reason: "HTTP_ERROR"});
});
