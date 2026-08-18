const test = require("node:test");
const assert = require("node:assert/strict");
const { isoWeekKey, weekGap } = require("../cloudfunctions/cloud/project/utils/streak_date_util.js");

test("handles ISO week boundaries across years", () => {
  assert.equal(isoWeekKey("2025-12-29"), "2026-W01");
  assert.equal(isoWeekKey("2026-01-04"), "2026-W01");
  assert.equal(isoWeekKey("2026-01-05"), "2026-W02");
  assert.equal(weekGap("2025-W52", "2026-W01"), 1);
});
