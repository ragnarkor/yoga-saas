/** 会员卡状态的无副作用判断。 */
function isExpired(card, now) {
  const start = Number(card && card.USER_CARD_START_TIME) || 0;
  if (start <= 0) return false;
  const end = Number(card && card.USER_CARD_END_TIME) || 0;
  return end > 0 && end <= now;
}

function isPendingActivation(card) {
  return !(Number(card && card.USER_CARD_START_TIME) > 0);
}

function canUsePendingForJoin(card, activation, allowedActivations) {
  return isPendingActivation(card) && allowedActivations.includes(activation);
}

function resolveCardType(card, tplTypeMap, { times, period }) {
  const tplType = card && card.USER_CARD_TPL_ID && tplTypeMap[card.USER_CARD_TPL_ID];
  const raw = String((card && card.USER_CARD_TYPE) || "").trim().toLowerCase();
  if (raw === period || tplType === period) return period;
  if (raw === times || tplType === times) return times;
  return times;
}

function meetDayFromTimeMark(timeMark) {
  if (!timeMark || timeMark.length < 11) return "";
  return `${timeMark.substr(1, 4)}-${timeMark.substr(5, 2)}-${timeMark.substr(7, 2)}`;
}

function isValidForMeetDay(card, meetDay, now, { canUsePending, resolveDays, timestampToDay, firstBook, firstUse }) {
  const pending = isPendingActivation(card);
  if (pending) {
    if (!canUsePending(card)) return false;
    if (!meetDay) return true;
    const activation = card.USER_CARD_ACTIVATE || "";
    if (activation === firstBook || activation === firstUse) {
      const days = resolveDays(card);
      const endDay = days > 0 ? timestampToDay(now + days * 86400000) : "";
      return !endDay || meetDay <= endDay;
    }
    return true;
  }
  if (isExpired(card, now) || !meetDay) return !isExpired(card, now);
  const startDay = timestampToDay(card.USER_CARD_START_TIME);
  const endDay = timestampToDay(card.USER_CARD_END_TIME);
  return (!startDay || meetDay >= startDay) && (!endDay || meetDay <= endDay);
}

module.exports = { isExpired, isPendingActivation, canUsePendingForJoin, resolveCardType, meetDayFromTimeMark, isValidForMeetDay };
