import assert from "node:assert/strict";
import test from "node:test";

const client = await import(new URL("../visit-counter-client.js", import.meta.url));

const body = {ok: true, stats: {total_visits: 12_483, today_visits: 327, date: "2026-09-08"}};

test("visit counter client accepts aggregate page-visit counts without user identity data", () => {
  assert.deepEqual(client.validateVisitStats(body), {
    available: true,
    totalVisits: 12_483,
    todayVisits: 327,
    date: "2026-09-08",
  });
  assert.deepEqual(client.validateVisitStats({ok: true, stats: {total_visits: -1}}), {available: false, reason: "INVALID_RESPONSE"});
});

test("visit counter client uses the public endpoint without credentials", async () => {
  let captured;
  const result = await client.fetchVisitStats({
    method: "POST",
    fetchImpl: async (url, init) => {
      captured = {url, init};
      return new Response(JSON.stringify(body), {status: 200});
    },
  });
  assert.equal(result.available, true);
  assert.equal(captured.url, client.PWA_VISIT_COUNTER_ENDPOINT);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.credentials, "omit");
  assert.equal(captured.init.cache, "no-store");
});
