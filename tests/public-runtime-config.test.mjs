import assert from "node:assert/strict";
import test from "node:test";
import handler, {PUBLIC_KEY_ENV} from "../api/public-runtime-config.js";

function responseProbe() {
  const captured = {headers: {}};
  return {
    captured,
    status(value) { captured.status = value; return this; },
    setHeader(name, value) { captured.headers[name] = value; return this; },
    send(value) { captured.body = value; return this; },
  };
}

test("runtime bridge emits only the public key assignment with no-store caching", () => {
  const previous = process.env[PUBLIC_KEY_ENV];
  process.env[PUBLIC_KEY_ENV] = "public-test-key";
  const response = responseProbe();
  handler({}, response);
  assert.equal(response.captured.status, 200);
  assert.equal(response.captured.headers["Cache-Control"], "no-store, max-age=0, must-revalidate");
  assert.equal(response.captured.headers["Content-Type"], "application/javascript; charset=utf-8");
  assert.equal(response.captured.body, 'window.__AILYNX_SUPABASE_PUBLISHABLE_KEY__ = "public-test-key";\n');
  if (previous === undefined) delete process.env[PUBLIC_KEY_ENV]; else process.env[PUBLIC_KEY_ENV] = previous;
});

test("missing env emits an empty value so Auth fails closed to FREE", () => {
  const previous = process.env[PUBLIC_KEY_ENV];
  delete process.env[PUBLIC_KEY_ENV];
  const response = responseProbe();
  handler({}, response);
  assert.equal(response.captured.body, 'window.__AILYNX_SUPABASE_PUBLISHABLE_KEY__ = "";\n');
  if (previous === undefined) delete process.env[PUBLIC_KEY_ENV]; else process.env[PUBLIC_KEY_ENV] = previous;
});
