const test = require("node:test");
const assert = require("node:assert/strict");
const tenantContext = require("../cloudfunctions/cloud/project/utils/tenant_context.js");

test("keeps tenant PID isolated across concurrent async requests", async () => {
  const readAfterDelay = (pid, delay) =>
    tenantContext.runWithPID(pid, async () => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return global.PID;
    });

  const [first, second] = await Promise.all([
    readAfterDelay("tenant-a", 15),
    readAfterDelay("tenant-b", 1),
  ]);
  assert.equal(first, "tenant-a");
  assert.equal(second, "tenant-b");
});
