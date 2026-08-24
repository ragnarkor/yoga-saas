function courseEndText(join) {
  const day = String((join && join.JOIN_MEET_DAY) || "").trim();
  const end = String((join && join.JOIN_MEET_TIME_END) || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(end)) {
    return "";
  }
  return `${day} ${end}`;
}

/** 课程结束后，未取消的预约按已到课处理。 */
function hasCourseEnded(join, nowText) {
  const endText = courseEndText(join);
  const now = String(nowText || "").slice(0, 16);
  return Boolean(endText && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(now) && endText < now);
}

module.exports = { courseEndText, hasCourseEnded };
