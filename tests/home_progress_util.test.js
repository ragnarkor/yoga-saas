const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deriveWeeklyGoal,
} = require("../cloudfunctions/cloud/project/service/home_progress_util.js");

function checked(day) {
  return { JOIN_IS_CHECKIN: 1, JOIN_MEET_DAY: day };
}

test("uses a starter goal when the member has no completed history", () => {
  assert.deepEqual(deriveWeeklyGoal([], "2026-08-24"), {
    goal: 2,
    personalized: false,
    observedWeeks: 0,
    average: 0,
  });
});

test("derives a stable goal from completed weeks and ignores current week", () => {
  const result = deriveWeeklyGoal(
    [
      checked("2026-08-03"),
      checked("2026-08-10"),
      checked("2026-08-11"),
      checked("2026-08-17"),
      checked("2026-08-18"),
      checked("2026-08-19"),
      checked("2026-08-24"), // 当前周，不参与目标推算
    ],
    "2026-08-24",
  );
  assert.equal(result.goal, 2);
  assert.equal(result.personalized, true);
  assert.equal(result.observedWeeks, 3);
});

test("rounds the recent weekly average up and caps the target", () => {
  const days = [
    "2026-08-03",
    "2026-08-10",
    "2026-08-11",
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
  ];
  const result = deriveWeeklyGoal(days.map(checked), "2026-08-24");
  assert.equal(result.goal, 3);
});

test("suggests a gentle restart after eight inactive weeks", () => {
  const result = deriveWeeklyGoal([checked("2026-05-01")], "2026-08-24");
  assert.equal(result.goal, 1);
  assert.equal(result.personalized, true);
});
