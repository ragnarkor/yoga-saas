const test = require("node:test");
const assert = require("node:assert/strict");
const { canAccessTenant } = require("../cloudfunctions/cloud/project/utils/tenant_authorization_util.js");

test("restricts an owner token to its own tenant", () => {
  const owner = { _pid: "tenant-a", ADMIN_TYPE: "owner" };
  assert.equal(canAccessTenant(owner, "tenant-a"), true);
  assert.equal(canAccessTenant(owner, "tenant-b"), false);
});

test("allows a super admin token to access any tenant", () => {
  const superAdmin = { _pid: "tenant-a", ADMIN_TYPE: "super" };
  assert.equal(canAccessTenant(superAdmin, "tenant-b"), true);
});
