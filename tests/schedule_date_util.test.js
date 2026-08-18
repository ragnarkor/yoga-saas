const test = require("node:test");
const assert = require("node:assert/strict");
const { addDays } = require("../cloudfunctions/cloud/project/utils/schedule_date_util.js");
test("adds days across month boundaries", () => {
  assert.equal(addDays("2026-08-28", 7), "2026-09-04");
});
