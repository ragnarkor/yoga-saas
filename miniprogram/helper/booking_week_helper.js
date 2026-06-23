const timeHelper = require('./time_helper.js');

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const STATUS_LEGEND = [
  { key: 'booking', label: '预约中', bg: '#5B8A72', text: '#ffffff' },
  { key: 'open', label: '可开课', bg: '#8FBCAA', text: '#ffffff' },
  { key: 'full', label: '已约满', bg: '#D98880', text: '#ffffff' },
  { key: 'cancelled', label: '已取消', bg: '#A8B0BA', text: '#ffffff' },
  { key: 'started', label: '已开课', bg: '#94A7C7', text: '#ffffff' },
  { key: 'noshow', label: '未到达', bg: '#F4F5F7', border: '#DEE2E6', text: '#868E96' },
];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDayStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function getWeekRange(weekOffset) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() + weekOffset * 7);
  const dow = now.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  const todayStr = formatDayStr(new Date());
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const day = formatDayStr(d);
    weekDays.push({
      day,
      shortLabel: pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()),
      weekday: WEEK_NAMES[d.getDay()],
      isToday: day === todayStr,
    });
  }

  return {
    startDay: weekDays[0].day,
    endDay: weekDays[6].day,
    weekDays,
    weekLabel: weekDays[0].day + ' 至 ' + weekDays[6].day,
  };
}

function _parseTs(dayStr, timeStr) {
  if (!dayStr || !timeStr) return 0;
  return timeHelper.time2Timestamp(dayStr + ' ' + timeStr + ':00') || 0;
}

function resolveSlotStatus(item, dayStr) {
  const now = timeHelper.time();
  const startTs = _parseTs(dayStr, item.timeStart);
  const endTs = _parseTs(dayStr, item.timeEnd);

  if (item.timeStatus === 0 || item.slotStatus === 0) {
    return STATUS_LEGEND.find((s) => s.key === 'cancelled');
  }

  if (endTs > 0 && now >= endTs) {
    return STATUS_LEGEND.find((s) => s.key === 'started');
  }

  if (startTs > 0 && now >= startTs && endTs > 0 && now < endTs) {
    return STATUS_LEGEND.find((s) => s.key === 'booking');
  }

  const booked = (item.stat && item.stat.succCnt) || 0;
  const limit = Number(item.limit) || 0;
  if (item.isLimit !== false && limit > 0 && booked >= limit) {
    return STATUS_LEGEND.find((s) => s.key === 'full');
  }

  if (booked > 0) {
    return STATUS_LEGEND.find((s) => s.key === 'booking');
  }

  return STATUS_LEGEND.find((s) => s.key === 'open');
}

function formatWeekCourse(item, dayStr, options = {}) {
  const st = resolveSlotStatus(item, dayStr) || STATUS_LEGEND[1];
  const booked = (item.stat && item.stat.succCnt) || 0;
  const limit = Number(item.limit) || 0;
  let slots = 99;
  if (limit > 0) {
    slots = Math.max(0, limit - booked);
  }

  let bookStatus = 'available';
  if (st.key === 'full') bookStatus = 'full';
  else if (st.key === 'started') bookStatus = 'started';

  const meetId = item._id || item.meetId;
  const timeMark = item.timeMark || item.mark || '';
  const timeStart = item.timeStart || item.start || '';
  const timeEnd = item.timeEnd || item.end || '';
  const coachName = item.coachName || item.teacherName || '教练';

  let detailUrl =
    '/pages/default/meet/detail/meet_detail?id=' +
    meetId +
    '&day=' +
    dayStr +
    '&timeMark=' +
    timeMark;

  if (options.coachMode) {
    const title = encodeURIComponent(item.title || '');
    const time = encodeURIComponent(dayStr + ' ' + timeStart + '-' + timeEnd);
    detailUrl =
      '/pages/admin/meet/join/admin_meet_join?meetId=' +
      meetId +
      '&mark=' +
      timeMark +
      '&title=' +
      title +
      '&time=' +
      time;
  }

  return {
    _id: meetId,
    day: dayStr,
    title: item.title || '未命名课程',
    typeName: item.typeName || '',
    typeId: item.typeId || '',
    timeStart,
    timeEnd,
    timeMark,
    coachName,
    slots,
    bookStatus,
    statusKey: st.key,
    statusLabel: st.label,
    cardBg: st.bg,
    cardBorder: st.border || '',
    textColor: st.text || (st.key === 'noshow' ? '#868E96' : '#ffffff'),
    cardId: dayStr + '_' + (timeMark || timeStart),
    detailUrl,
  };
}

function buildWeekColumns(weekDays, rawList, activeTabId, options = {}) {
  const columns = weekDays.map((d) => ({
    ...d,
    courses: [],
  }));

  const colMap = {};
  columns.forEach((c) => {
    colMap[c.day] = c;
  });

  (rawList || []).forEach((item) => {
    const dayStr = item.day;
    if (!dayStr || !colMap[dayStr]) return;
    if (activeTabId && activeTabId !== '0' && String(item.typeId) !== String(activeTabId)) {
      return;
    }
    colMap[dayStr].courses.push(formatWeekCourse(item, dayStr, options));
  });

  columns.forEach((col) => {
    col.courses.sort((a, b) => {
      if (a.timeStart !== b.timeStart) {
        return a.timeStart < b.timeStart ? -1 : 1;
      }
      return String(a.title).localeCompare(String(b.title), 'zh');
    });
  });

  return columns;
}

function getStatusLegend() {
  return STATUS_LEGEND.slice();
}

function slotsToListItems(slots) {
  return (slots || []).map((s) => ({
    day: s.day,
    _id: s.meetId,
    meetId: s.meetId,
    title: s.title,
    typeName: s.typeName,
    typeId: s.typeId,
    timeStart: s.start,
    timeEnd: s.end,
    timeMark: s.mark,
    mark: s.mark,
    coachName: s.teacherName,
    teacherName: s.teacherName,
    stat: s.stat,
    limit: s.limit,
    isLimit: s.isLimit,
    slotStatus: s.slotStatus,
  }));
}

function buildWeekColumnsFromSlots(weekDays, slots, activeTabId, options = {}) {
  return buildWeekColumns(weekDays, slotsToListItems(slots), activeTabId, options);
}

function buildStarText(difficulty) {
  const diff = Math.min(5, Math.max(1, Number(difficulty) || 3));
  let starText = '';
  for (let i = 0; i < 5; i++) {
    starText += i < diff ? '★' : '☆';
  }
  return starText;
}

function formatBookingGridCell(slot, options = {}) {
  const listItem = {
    day: slot.day,
    _id: slot.meetId,
    meetId: slot.meetId,
    title: slot.title,
    typeName: slot.typeName,
    typeId: slot.typeId,
    timeStart: slot.start,
    timeEnd: slot.end,
    timeMark: slot.mark,
    mark: slot.mark,
    coachName: slot.teacherName,
    teacherName: slot.teacherName,
    stat: slot.stat,
    limit: slot.limit,
    isLimit: slot.isLimit,
    slotStatus: slot.slotStatus,
  };
  const course = formatWeekCourse(listItem, slot.day, options);
  const borderPart = course.cardBorder ? `border:2rpx solid ${course.cardBorder};` : '';
  return {
    ...course,
    meetId: slot.meetId,
    mark: slot.mark,
    day: slot.day,
    start: slot.start,
    end: slot.end,
    teacherName: slot.teacherName || '教练',
    starText: buildStarText(slot.difficulty),
    duration: slot.duration || 60,
    cardStyle: `background-color:${course.cardBg};color:${course.textColor};${borderPart}`,
  };
}

function buildBookingGrid(weekDays, slots, activeTabId, options = {}) {
  const filtered = (slots || []).filter((s) => {
    if (!activeTabId || activeTabId === '0') return true;
    return String(s.typeId) === String(activeTabId);
  });

  const timeSet = new Set();
  filtered.forEach((s) => {
    if (s.start) timeSet.add(s.start);
  });
  const timeRows = Array.from(timeSet).sort();

  const gridRows = timeRows.map((time) => ({
    time,
    cells: weekDays.map((d) => {
      const hit = filtered.find((s) => s.start === time && s.day === d.day);
      return hit ? formatBookingGridCell(hit, options) : null;
    }),
  }));

  return {
    gridRows,
    hasCourses: filtered.length > 0,
  };
}

module.exports = {
  getWeekRange,
  buildWeekColumns,
  buildWeekColumnsFromSlots,
  buildBookingGrid,
  getStatusLegend,
  resolveSlotStatus,
};
