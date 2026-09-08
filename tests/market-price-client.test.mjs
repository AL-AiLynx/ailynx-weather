import assert from "node:assert/strict";
import test from "node:test";

const client = await import(new URL("../market-price-client.js", import.meta.url));

test("Coinbase spot price client returns only a validated public ticker price", async () => {
  const result = await client.fetchBtcSpotPrice({
    fetchImpl: async () => new Response(JSON.stringify({
      price: "79134.04",
      time: "2026-09-08T00:00:00.000Z",
    }), {status: 200}),
  });

  assert.deepEqual(result, {
    available: true,
    price: 79134.04,
    observedAt: "2026-09-08T00:00:00.000Z",
    source: "COINBASE BTC-USD SPOT",
  });
  assert.match(client.COINBASE_BTC_USD_TICKER_ENDPOINT, /api\.exchange\.coinbase\.com\/products\/BTC-USD\/ticker/);
});

test("Coinbase spot price client reports invalid or failed reads without fabricating a price", async () => {
  const result = await client.fetchBtcSpotPrice({
    fetchImpl: async () => new Response(JSON.stringify({price: "not-a-price"}), {status: 200}),
  });

  assert.equal(result.available, false);
  assert.equal(result.reason, "request_failed");
});
