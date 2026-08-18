/** 排课日期计算。 */
function addDays(dayStr, offset) {
  const date = new Date(String(dayStr).replace(/-/g, "/") + " 00:00:00");
  date.setDate(date.getDate() + Number(offset || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
module.exports = { addDays };
