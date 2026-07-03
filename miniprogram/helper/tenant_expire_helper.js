function pad(n) {
  return n < 10 ? `0${n}` : String(n);
}

function normalizeExpireTime(expireTime) {
  let n = Number(expireTime) || 0;
  if (n <= 0) return 0;
  if (n >= 1e11) return Math.floor(n / 1000);
  return Math.floor(n);
}

function isLongTerm(expireTime) {
  return normalizeExpireTime(expireTime) <= 0;
}

function isExpired(expireTime) {
  const ts = normalizeExpireTime(expireTime);
  if (ts <= 0) return false;
  return ts <= Math.floor(Date.now() / 1000);
}

function expireTimeToDay(expireTime) {
  if (isLongTerm(expireTime)) return "";
  const ts = normalizeExpireTime(expireTime);
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatExpireDesc(expireTime) {
  if (isLongTerm(expireTime)) return "长期有效";
  const day = expireTimeToDay(expireTime);
  if (isExpired(expireTime)) return `${day} 已到期`;
  return `${day} 到期`;
}

function enrichExpireFields(item) {
  const expireTime = normalizeExpireTime(
    item.TENANT_EXPIRE_TIME || item.expireTime,
  );
  return {
    ...item,
    expireTime,
    expireDay: expireTimeToDay(expireTime),
    expireDesc: formatExpireDesc(expireTime),
    isLongTerm: isLongTerm(expireTime),
    isExpired: isExpired(expireTime),
  };
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = {
  isLongTerm,
  isExpired,
  expireTimeToDay,
  formatExpireDesc,
  enrichExpireFields,
  todayYMD,
};
