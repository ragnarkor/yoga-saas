function buildPeriodIncomeMap(logs, cardMap, mode = "per_day") {
  const valid = (logs || []).filter((log) => {
    const card = cardMap[log.CARD_LOG_USER_CARD_ID];
    return card && card.USER_CARD_TYPE === "period" && log.CARD_LOG_STATUS === 1;
  });
  const grouped = {};
  for (const log of valid) {
    const cardId = log.CARD_LOG_USER_CARD_ID;
    const day = (log.CARD_LOG_MEET_DAY || "").trim() || "1970-01-01";
    grouped[cardId] ||= {};
    grouped[cardId][day] ||= [];
    grouped[cardId][day].push(log);
  }
  const result = {};
  for (const cardId of Object.keys(grouped)) {
    const card = cardMap[cardId];
    const days = Object.keys(grouped[cardId]).sort();
    const price = Number(card.USER_CARD_PRICE) || 0;
    if (mode !== "per_day") {
      const first = grouped[cardId][days[0]]?.[0];
      if (first) result[first._id] = { amount: price, subtitle: "首次上课" };
      continue;
    }
    const dailyAmount = price / Math.max(Number(card.USER_CARD_DAYS) || 1, 1);
    for (const day of days) {
      const first = grouped[cardId][day][0];
      result[first._id] = { amount: dailyAmount, subtitle: "按上课日分摊" };
    }
  }
  return result;
}

module.exports = { buildPeriodIncomeMap };
