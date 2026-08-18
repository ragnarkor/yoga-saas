const test = require("node:test");
const assert = require("node:assert/strict");
const conflictUtil = require("../cloudfunctions/cloud/project/utils/schedule_conflict_util.js");

const meet = {
  MEET_TITLE: "流瑜伽",
  MEET_STYLE_SET: { teacherId: "teacher-1" },
};

function failWithAppError(message) {
  throw new Error(message);
}

test("allows non-overlapping slots for the same coach", async () => {
  await conflictUtil.validateDayTeacherTimes({
    meet,
    meetId: "meet-1",
    day: "2026-08-14",
    times: [
      { mark: "slot-1", start: "09:00", end: "10:00", status: 1 },
      { mark: "slot-2", start: "10:10", end: "11:00", status: 1 },
    ],
    tenantConfig: { groupBufferAfter: 0 },
    privateCategoryIds: [],
    loadTeacherBlocks: async () => [],
    onError: failWithAppError,
  });
});

test("rejects an overlap with an existing coach schedule", async () => {
  await assert.rejects(
    () =>
      conflictUtil.validateDayTeacherTimes({
        meet,
        meetId: "meet-1",
        day: "2026-08-14",
        times: [{ mark: "slot-1", start: "09:30", end: "10:30", status: 1 }],
        tenantConfig: { groupBufferAfter: 0 },
        privateCategoryIds: [],
        loadTeacherBlocks: async () => [
          {
            meetId: "meet-2",
            title: "普拉提",
            start: "09:00",
            end: "10:00",
            blockStart: "09:00",
            blockEnd: "10:00",
            blockStartMin: 540,
            blockEndMin: 600,
          },
        ],
        onError: failWithAppError,
      }),
    /与教练已有排课冲突/,
  );
});
