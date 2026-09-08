import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("account modal separates login, signup, reset, and member-only states", async () => {
  const [html, ui] = await Promise.all([read("index.html"), read("member-community.js")]);
  for (const text of ["로그인", "무료 회원가입", "비밀번호 찾기", "비밀번호 재설정", "로그아웃", "멤버십"]) assert.match(html, new RegExp(text));
  assert.match(html, /data-auth-panel="login"/);
  assert.match(html, /data-auth-panel="signup" hidden/);
  assert.match(html, /data-auth-panel="reset" hidden/);
  assert.match(html, /id="accountAuthenticated" hidden/);
  assert.match(ui, /accountAnonymous.*hidden/);
  assert.match(ui, /accountAuthenticated.*hidden/);
  assert.match(ui, /showView\("login"\)/);
  assert.match(ui, /state\.user\?\.email/);
});

test("locked assets retain auth-or-upgrade routing without account mutation", async () => {
  const [app, gate, ui] = await Promise.all([read("app.js"), read("auth-gate.js"), read("member-community.js")]);
  assert.match(app, /requestAssetAccess/);
  assert.match(gate, /AUTH_REQUIRED/);
  assert.match(gate, /UPGRADE_REQUIRED/);
  assert.match(gate, /ailynx-auth-logout/);
  assert.doesNotMatch(ui, /service_role|subscriptions\s*\.\s*insert/i);
});
