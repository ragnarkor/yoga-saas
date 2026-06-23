const timeHelper = require('./time_helper.js');

const BUFFER_PRESETS = [
  { key: 'default', label: '默认', desc: '前15/后15分钟' },
  { key: 'compact', label: '紧凑', desc: '前5/后5分钟' },
  { key: 'none', label: '无缓冲', desc: '0分钟' },
  { key: 'custom', label: '自定义', desc: '' },
];

function buildDayDesc(day) {
  return timeHelper.fmtDateCHN(day) + ' (' + timeHelper.week(day) + ')';
}

module.exports = {
  BUFFER_PRESETS,
  buildDayDesc,
};
