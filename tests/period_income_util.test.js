const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPeriodIncomeMap } = require("../cloudfunctions/cloud/project/utils/period_income_util.js");

test("allocates a period card once per class day", () => {
  const logs = [
    { _id: "a", CARD_LOG_USER_CARD_ID: "card", CARD_LOG_MEET_DAY: "2026-08-01", CARD_LOG_STATUS: 1 },
    { _id: "b", CARD_LOG_USER_CARD_ID: "card", CARD_LOG_MEET_DAY: "2026-08-01", CARD_LOG_STATUS: 1 },
    { _id: "c", CARD_LOG_USER_CARD_ID: "card", CARD_LOG_MEET_DAY: "2026-08-03", CARD_LOG_STATUS: 1 },
  ];
  const result = buildPeriodIncomeMap(logs, {
    card: { USER_CARD_TYPE: "period", USER_CARD_PRICE: 300, USER_CARD_DAYS: 30 },
  });
  assert.equal(result.a.amount, 10);
  assert.equal(result.b, undefined);
  assert.equal(result.c.amount, 10);
});

test("keeps first-class allocation available for legacy reports", () => {
  const result = buildPeriodIncomeMap([
    { _id: "a", CARD_LOG_USER_CARD_ID: "card", CARD_LOG_MEET_DAY: "2026-08-01", CARD_LOG_STATUS: 1 },
    { _id: "b", CARD_LOG_USER_CARD_ID: "card", CARD_LOG_MEET_DAY: "2026-08-02", CARD_LOG_STATUS: 1 },
  ], { card: { USER_CARD_TYPE: "period", USER_CARD_PRICE: 300, USER_CARD_DAYS: 30 } }, "first_class");
  assert.equal(result.a.amount, 300);
  assert.equal(result.b, undefined);
});
