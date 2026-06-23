const AdminMeetBiz = require('../biz/admin_meet_biz.js');
const pageHelper = require('./page_helper.js');
const timeHelper = require('./time_helper.js');
const defaultCoverHelper = require('./default_cover_helper.js');

const COURSE_COLOR_PALETTE = [
  '#e57373',
  '#f48fb1',
  '#64b5f6',
  '#81c784',
  '#ffb74d',
  '#ba68c8',
  '#4db6ac',
  '#ffd54f',
];

const TYPE_COLOR_MAP = {
  '1': '#64b5f6',
  '2': '#81c784',
  '3': '#f48fb1',
};

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function addMinutesToTime(timeStr, minutes) {
  const parts = (timeStr || '00:00').split(':');
  const total = Number(parts[0]) * 60 + Number(parts[1] || 0) + Number(minutes || 0);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return pad2(nh) + ':' + pad2(nm);
}

function buildDayDesc(day) {
  return timeHelper.fmtDateCHN(day) + ' (' + timeHelper.week(day) + ')';
}

/** 读取课程配置色（优先 MEET_STYLE_SET.color，与课程管理一致） */
function resolveCourseColor(styleSet, typeId, index = 0) {
  const raw = styleSet || {};
  if (raw.color) return raw.color;
  const tid = String(typeId || '');
  if (TYPE_COLOR_MAP[tid]) return TYPE_COLOR_MAP[tid];
  return COURSE_COLOR_PALETTE[index % COURSE_COLOR_PALETTE.length];
}

function formatCoursePickerItem(meet, index = 0) {
  const styleSet = meet.MEET_STYLE_SET || {};
  const style = AdminMeetBiz.normalizeCourseStyleSet(styleSet);
  let cover = '';
  if (typeof style.pic === 'string' && style.pic) {
    cover = pageHelper.fmtCoverUrl(style.pic, meet._id) || style.pic;
  } else if (Array.isArray(style.pic) && style.pic.length) {
    cover = pageHelper.fmtCoverUrl(style.pic[0], meet._id) || style.pic[0];
  }
  if (!cover) {
    cover = defaultCoverHelper.pickDefaultCover(meet._id);
  }
  const duration = Number(style.duration) || 60;
  const desc = (style.desc || '').trim();
  const color = resolveCourseColor(styleSet, meet.MEET_TYPE_ID, index);
  return {
    _id: meet._id,
    title: meet.MEET_TITLE,
    typeName: meet.MEET_TYPE_NAME || '',
    typeId: meet.MEET_TYPE_ID || '',
    cover,
    duration,
    durationText: duration + '分钟',
    teacherName: style.teacherName || '待定',
    desc: desc.length > 48 ? desc.slice(0, 48) + '…' : desc,
    color,
  };
}

function parseCourseMeta(meet, index = 0) {
  const styleSet = meet.MEET_STYLE_SET || {};
  const style = AdminMeetBiz.normalizeCourseStyleSet(styleSet);
  const duration = Number(style.duration) || 60;
  const capacity = Number(style.capacity) || 0;
  return {
    meetId: meet._id,
    title: meet.MEET_TITLE || '',
    duration,
    capacity,
    teacherName: style.teacherName || '',
    color: resolveCourseColor(styleSet, meet.MEET_TYPE_ID, index),
    durationText: duration + '分钟',
  };
}

function formatScheduleSlot(slot, meetMeta) {
  const styleSet = (meetMeta && meetMeta.styleSet) || {};
  const typeId = (meetMeta && meetMeta.typeId) || slot.typeId;
  const index = (meetMeta && meetMeta.index) || 0;
  const color = resolveCourseColor(styleSet, typeId, index);
  const diff = Number(slot.difficulty) || 3;
  let starText = '';
  for (let i = 0; i < 5; i++) {
    starText += i < diff ? '★' : '☆';
  }
  return {
    ...slot,
    color,
    cardStyle: 'background-color:' + color + ';',
    starText,
    duration: slot.duration || 60,
    cardId: slot.day + '_' + slot.mark,
  };
}

function upsertTimeSlot(daysSet, { day, start, end, limit, mark, teacherId, teacherName }) {
  const list = (daysSet || []).slice();
  let dayNode = list.find((d) => d.day === day);
  if (!dayNode) {
    dayNode = { day, dayDesc: buildDayDesc(day), times: [] };
    list.push(dayNode);
  }

  if (mark) {
    const markStr = String(mark);
    const idx = dayNode.times.findIndex((t) => String(t.mark) === markStr);
    if (idx >= 0) {
      dayNode.times[idx].start = start;
      dayNode.times[idx].end = end;
      dayNode.times[idx].teacherId = teacherId || '';
      dayNode.times[idx].teacherName = teacherName || '';
      if (limit > 0) {
        dayNode.times[idx].limit = limit;
        dayNode.times[idx].isLimit = true;
      } else {
        dayNode.times[idx].isLimit = false;
      }
      return list;
    }
  }

  const node = AdminMeetBiz.getNewTimeNode(day);
  node.start = start;
  node.end = end;
  node.teacherId = teacherId || '';
  node.teacherName = teacherName || '';
  if (limit > 0) {
    node.limit = limit;
    node.isLimit = true;
  }
  dayNode.times.push(node);
  return list;
}

function findTimeSlot(daysSet, { day, mark }) {
  const dayNode = (daysSet || []).find((d) => d.day === day);
  if (!dayNode) return null;
  const markStr = String(mark || '');
  return (dayNode.times || []).find((t) => String(t.mark) === markStr) || null;
}

function removeTimeSlot(daysSet, { day, mark }) {
  const markStr = String(mark || '');
  const list = (daysSet || []).slice();
  const dayNode = list.find((d) => d.day === day);
  if (!dayNode) return list;
  dayNode.times = (dayNode.times || []).filter((t) => String(t.mark) !== markStr);
  return list.filter((d) => (d.times || []).length > 0);
}

function hasBookings(timeNode) {
  if (!timeNode || !timeNode.stat) return false;
  return !!(timeNode.stat.succCnt || timeNode.stat.waitCheckCnt);
}

module.exports = {
  addMinutesToTime,
  buildDayDesc,
  resolveCourseColor,
  formatCoursePickerItem,
  parseCourseMeta,
  formatScheduleSlot,
  upsertTimeSlot,
  findTimeSlot,
  removeTimeSlot,
  hasBookings,
};
