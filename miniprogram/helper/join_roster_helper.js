const timeHelper = require('./time_helper.js');

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未签到' },
  { key: 'checked', label: '已签到' },
  { key: 'cancelled', label: '已取消' },
];

const JOIN_STATUS_SUCC = 1;
const JOIN_STATUS_CANCEL = 10;
const JOIN_STATUS_ADMIN_CANCEL = 99;

function _parseTs(dayStr, timeStr) {
  if (!dayStr || !timeStr) return 0;
  return timeHelper.time2Timestamp(dayStr + ' ' + timeStr + ':00') || 0;
}

function resolveSlotStatus(item, dayStr) {
  const now = timeHelper.time();
  const startTs = _parseTs(dayStr, item.timeStart);
  const endTs = _parseTs(dayStr, item.timeEnd);

  if (item.timeStatus === 0 || item.slotStatus === 0) {
    return '已取消';
  }
  if (endTs > 0 && now >= endTs) {
    return '已开课';
  }
  if (startTs > 0 && now >= startTs && endTs > 0 && now < endTs) {
    return '进行中';
  }
  const booked = (item.stat && item.stat.succCnt) || 0;
  const limit = Number(item.limit) || 0;
  if (item.isLimit !== false && limit > 0 && booked >= limit) {
    return '已约满';
  }
  if (booked > 0) {
    return '预约中';
  }
  return '可开课';
}

function parseJoinMember(raw) {
  const forms = raw.JOIN_FORMS || [];
  let name = raw.memberName || '';
  let mobile = raw.memberMobile || '';
  if (!name || !mobile) {
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      const title = f.title || '';
      if (!name && (title.indexOf('姓名') >= 0 || title === '名字' || f.mark === 'name')) {
        name = f.val || '';
      }
      if (!mobile && (f.type === 'mobile' || title.indexOf('手机') >= 0)) {
        mobile = f.val || '';
      }
    }
  }
  if (!name && forms[0] && forms[0].val) name = forms[0].val;

  const status = Number(raw.JOIN_STATUS);
  const checkin = Number(raw.JOIN_IS_CHECKIN) === 1;
  let groupKey = 'cancelled';
  let statusLabel = '已取消';
  if (status === JOIN_STATUS_SUCC) {
    groupKey = checkin ? 'checked' : 'pending';
    statusLabel = checkin ? '已签到' : '未签到';
  } else if (status === JOIN_STATUS_CANCEL) {
    statusLabel = '用户取消';
  } else if (status === JOIN_STATUS_ADMIN_CANCEL) {
    statusLabel = '系统取消';
  }

  let cardText = '';
  if (raw.cardName) {
    cardText = raw.cardTimes > 1
      ? raw.cardName + ' · 扣' + raw.cardTimes + '次'
      : raw.cardName;
  }

  return {
    id: raw._id,
    userId: raw.JOIN_USER_ID || '',
    name: name || '会员',
    mobile: mobile,
    joinTime: raw.JOIN_EDIT_TIME || '',
    checkin: checkin,
    status: status,
    groupKey: groupKey,
    statusLabel: statusLabel,
    cardText: cardText,
    avatarSrc: raw.avatarSrc || '',
    cancelReason: raw.JOIN_REASON || '',
    code: raw.JOIN_CODE || '',
  };
}

function groupMembers(list) {
  const pending = [];
  const checked = [];
  const cancelled = [];
  (list || []).forEach(function (raw) {
    const item = parseJoinMember(raw);
    if (item.groupKey === 'pending') pending.push(item);
    else if (item.groupKey === 'checked') checked.push(item);
    else cancelled.push(item);
  });
  return { pending: pending, checked: checked, cancelled: cancelled };
}

function buildSections(groups, activeFilter) {
  const sectionDefs = [
    { key: 'pending', title: '未签到', list: groups.pending },
    { key: 'checked', title: '已签到', list: groups.checked },
    { key: 'cancelled', title: '已取消', list: groups.cancelled },
  ];
  if (activeFilter === 'all') {
    return sectionDefs.filter(function (s) {
      return s.list.length > 0;
    });
  }
  const hit = sectionDefs.find(function (s) {
    return s.key === activeFilter;
  });
  return hit && hit.list.length ? [hit] : [];
}

function buildFlatList(groups, activeFilter) {
  if (activeFilter === 'all') {
    return groups.pending.concat(groups.checked, groups.cancelled);
  }
  if (activeFilter === 'pending') return groups.pending;
  if (activeFilter === 'checked') return groups.checked;
  if (activeFilter === 'cancelled') return groups.cancelled;
  return [];
}

function resolveSessionStatus(session) {
  const item = {
    timeStart: session.start,
    timeEnd: session.end,
    timeStatus: session.slotStatus === 0 ? 0 : 1,
    slotStatus: session.slotStatus,
    stat: { succCnt: session.booked || 0 },
    limit: session.limit || 0,
    isLimit: session.limit > 0,
  };
  return resolveSlotStatus(item, session.day);
}

function buildCapacityText(booked, limit) {
  if (limit > 0) return '已约 ' + booked + '/' + limit;
  return booked > 0 ? '已约 ' + booked + ' 人' : '暂无人预约';
}

function buildSeatPercent(booked, limit) {
  if (!limit || limit <= 0) return booked > 0 ? 60 : 0;
  return Math.min(100, Math.round((booked / limit) * 100));
}

function buildStarText(difficulty) {
  const diff = Math.min(5, Math.max(1, Number(difficulty) || 3));
  let starText = '';
  for (let i = 0; i < 5; i++) {
    starText += i < diff ? '★' : '☆';
  }
  return starText;
}

module.exports = {
  FILTERS: FILTERS,
  JOIN_STATUS_SUCC: JOIN_STATUS_SUCC,
  parseJoinMember: parseJoinMember,
  groupMembers: groupMembers,
  buildSections: buildSections,
  buildFlatList: buildFlatList,
  resolveSessionStatus: resolveSessionStatus,
  buildCapacityText: buildCapacityText,
  buildSeatPercent: buildSeatPercent,
  buildStarText: buildStarText,
};
