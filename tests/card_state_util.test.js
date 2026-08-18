const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("../cloudfunctions/cloud/project/utils/card_state_util.js");

test("recognizes pending and expired cards", () => {
  assert.equal(state.isPendingActivation({ USER_CARD_START_TIME: 0 }), true);
  assert.equal(state.isExpired({ USER_CARD_START_TIME: 0 }, 100), false);
  assert.equal(state.isExpired({ USER_CARD_START_TIME: 10, USER_CARD_END_TIME: 100 }, 100), true);
  assert.equal(state.isExpired({ USER_CARD_START_TIME: 10, USER_CARD_END_TIME: 101 }, 100), false);
  assert.equal(state.canUsePendingForJoin({ USER_CARD_START_TIME: 0 }, "first_book", ["first_book"]), true);
  assert.equal(state.canUsePendingForJoin({ USER_CARD_START_TIME: 1 }, "first_book", ["first_book"]), false);
  assert.equal(state.resolveCardType({ USER_CARD_TYPE: "period" }, {}, { times: "times", period: "period" }), "period");
  assert.equal(state.resolveCardType({ USER_CARD_TPL_ID: "t1" }, { t1: "period" }, { times: "times", period: "period" }), "period");
  assert.equal(state.meetDayFromTimeMark("T20260814ABCDEFGHIJ"), "2026-08-14");
});
