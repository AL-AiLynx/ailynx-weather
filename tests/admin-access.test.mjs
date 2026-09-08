import test from "node:test";
import assert from "node:assert/strict";
import {isAdminMembership, isAdminUser} from "../admin-access.js";

test("admin display entry requires an authenticated user whose UUID is allowlisted", () => {
  const config = {adminUserIds: ["approved-user-id"]};
  assert.equal(isAdminUser({id: "approved-user-id"}, config), true);
  assert.equal(isAdminUser({id: "other-user"}, config), false);
  assert.equal(isAdminMembership({authenticated: false, user: {id: "approved-user-id"}}, config), false);
  assert.equal(isAdminMembership({authenticated: true, user: {id: "approved-user-id"}}, config), true);
});
