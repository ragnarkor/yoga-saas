const MS_DAY = 86400000;

function parseDay(day) {
  return new Date(String(day || "").replace(/-/g, "/") + " 12:00:00");
}

function isoWeekKey(day) {
  const d = parseDay(day);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const week = Math.ceil(((d - yearStart) / MS_DAY + yearStart.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function isoWeekMonday(key) {
  const m = String(key || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
  return monday;
}

function weekGap(lastWeek, thisWeek) {
  if (!lastWeek || !thisWeek) return null;
  const lastMon = isoWeekMonday(lastWeek);
  const thisMon = isoWeekMonday(thisWeek);
  if (!lastMon || !thisMon) return null;
  return Math.round((thisMon - lastMon) / (7 * MS_DAY));
}

module.exports = { isoWeekKey, isoWeekMonday, weekGap };
