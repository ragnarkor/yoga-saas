const DAY_MS = 86400000;

function parseDayUtc(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  if (!match) return null;
  const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(value) ? value : null;
}

function weekMondayUtc(dayMs) {
  const date = new Date(dayMs);
  const offset = (date.getUTCDay() + 6) % 7;
  return dayMs - offset * DAY_MS;
}

/**
 * 根据最近 8 个已经结束的自然周推算个人每周练习目标。
 * - 当前周不参与，保证目标在一周内稳定；
 * - 从用户首次进入观察窗的签到周开始计，避免把入会前的空白周算进去；
 * - 向上取整形成轻微进阶目标，并限制在每周 1–5 节；
 * - 完全没有历史签到时，给出首次建议值 2 节。
 */
function deriveWeeklyGoal(joins, todayStr) {
  const todayMs = parseDayUtc(todayStr);
  if (todayMs === null) {
    return { goal: 2, personalized: false, observedWeeks: 0, average: 0 };
  }

  const currentMonday = weekMondayUtc(todayMs);
  const history = (joins || [])
    .filter((item) => Number(item.JOIN_IS_CHECKIN) === 1)
    .map((item) => parseDayUtc(item.JOIN_MEET_DAY))
    .filter((dayMs) => dayMs !== null && dayMs < currentMonday)
    .sort((a, b) => a - b);

  if (!history.length) {
    return { goal: 2, personalized: false, observedWeeks: 0, average: 0 };
  }

  const windowStart = currentMonday - 8 * 7 * DAY_MS;
  const recent = history.filter((dayMs) => dayMs >= windowStart);
  if (!recent.length) {
    return { goal: 1, personalized: true, observedWeeks: 8, average: 0 };
  }

  const firstObservedMonday = weekMondayUtc(recent[0]);
  const observedStart = Math.max(windowStart, firstObservedMonday);
  const observedWeeks = Math.max(
    1,
    Math.min(8, Math.round((currentMonday - observedStart) / (7 * DAY_MS))),
  );
  const average = recent.length / observedWeeks;
  const goal = Math.max(1, Math.min(5, Math.ceil(average)));

  return { goal, personalized: true, observedWeeks, average };
}

module.exports = { deriveWeeklyGoal };
