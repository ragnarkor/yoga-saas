const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hasCourseEnded,
} = require("../cloudfunctions/cloud/project/utils/attendance_util.js");

test("课程结束后视为到课", () => {
  const join = {
    JOIN_MEET_DAY: "2026-08-24",
    JOIN_MEET_TIME_END: "21:00",
  };
  assert.equal(hasCourseEnded(join, "2026-08-24 21:01"), true);
});

test("课程尚未结束时不自动到课", () => {
  const join = {
    JOIN_MEET_DAY: "2026-08-24",
    JOIN_MEET_TIME_END: "21:00",
  };
  assert.equal(hasCourseEnded(join, "2026-08-24 20:59"), false);
  assert.equal(hasCourseEnded(join, "2026-08-24 21:00"), false);
});

test("无效日期不会被自动到课", () => {
  assert.equal(hasCourseEnded({}, "2026-08-24 21:01"), false);
});
