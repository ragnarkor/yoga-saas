const timeUtil = require("../../framework/utils/time_util.js");

/** 统一为 Unix 秒（兼容历史毫秒数据） */
function normalizeExpireTime(expireTime) {
  let n = Number(expireTime) || 0;
  if (n <= 0) return 0;
  if (n >= 1e11) return Math.floor(n / 1000);
  return Math.floor(n);
}

function normalizeNow(now) {
  if (now) {
    return now >= 1e11 ? Math.floor(now / 1000) : Math.floor(now);
  }
  return Math.floor(timeUtil.time() / 1000);
}

function isLongTerm(expireTime) {
  return normalizeExpireTime(expireTime) <= 0;
}

function isExpired(expireTime, now) {
  const ts = normalizeExpireTime(expireTime);
  if (ts <= 0) return false;
  return ts <= normalizeNow(now);
}

function expireDayToTime(day) {
  day = String(day || "").trim();
  if (!day) return 0;
  const ms = timeUtil.time2Timestamp(`${day} 23:59:59`);
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}

function expireTimeToDay(expireTime) {
  if (isLongTerm(expireTime)) return "";
  const ts = normalizeExpireTime(expireTime);
  return timeUtil.timestamp2Time(ts * 1000, "Y-M-D");
}

function formatExpireDesc(expireTime, now) {
  if (isLongTerm(expireTime)) return "长期有效";
  const day = expireTimeToDay(expireTime);
  if (isExpired(expireTime, now)) return `${day} 已到期`;
  return `${day} 到期`;
}

function enrichTenantExpire(tenant, now) {
  const cur = normalizeNow(now);
  const expireTime = normalizeExpireTime(tenant.TENANT_EXPIRE_TIME);
  const expired = isExpired(expireTime, cur);
  const longTerm = isLongTerm(expireTime);
  return {
    ...tenant,
    TENANT_EXPIRE_TIME: expireTime,
    expireTime,
    expireDay: expireTimeToDay(expireTime),
    expireDesc: formatExpireDesc(expireTime, cur),
    isLongTerm: longTerm,
    isExpired: expired,
    isExpiringSoon:
      !longTerm && !expired && expireTime - cur <= 86400 * 30,
  };
}

module.exports = {
  isLongTerm,
  isExpired,
  normalizeExpireTime,
  expireDayToTime,
  expireTimeToDay,
  formatExpireDesc,
  enrichTenantExpire,
};
