const ACTIVATE_OPTIONS = [
  { value: 'immediate', label: '立即激活', desc: '发卡后立即生效，有效期从今日起算' },
  { value: 'first_book', label: '首次预约激活', desc: '会员首次成功预约课程时开始计时' },
  { value: 'first_class', label: '首次上课激活', desc: '会员首次签到上课时开始计时' },
  { value: 'first_use_limit', label: '首次使用+限时天数', desc: '首次预约或首次上课（以先到为准）开始限时' },
];

function getActivateLabel(value) {
  const hit = ACTIVATE_OPTIONS.find((item) => item.value === value);
  return hit ? hit.label : '立即激活';
}

module.exports = {
  ACTIVATE_OPTIONS,
  getActivateLabel,
};
