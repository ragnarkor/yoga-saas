/**
 * 会员端图标配色：基于租户主题色，同色系深浅变化，避免跨色相彩虹色
 */
const themeHelper = require('./theme_helper.js');

const INACTIVE_TAB = '#999999';
const INACTIVE_ICON = '#8F959E';

/** 选中 / 主功能图标色 */
function getActiveColor(themeColor) {
  return themeHelper.normalizeHex(themeColor || themeHelper.DEFAULT_THEME);
}

/** 未选中 Tab、次要图标 */
function getInactiveColor() {
  return INACTIVE_ICON;
}

function getInactiveTabColor() {
  return INACTIVE_TAB;
}

/**
 * 列表项图标色：同色系微变化（主色 / 略深），保持视觉层次但不跳色
 */
function pickColor(themeColor, index) {
  const base = getActiveColor(themeColor);
  const i = Number(index) || 0;
  if (i % 2 === 0) return base;
  return themeHelper.getThemeDark(base);
}

/** 图标浅底（首页工具栏等） */
function pickIconBg(themeColor, index) {
  const base = getActiveColor(themeColor);
  const i = Number(index) || 0;
  const ratios = [0.88, 0.92, 0.85];
  return themeHelper.mixColor(base, '#FFFFFF', ratios[i % ratios.length]);
}

module.exports = {
  getActiveColor,
  getInactiveColor,
  getInactiveTabColor,
  pickColor,
  pickIconBg,
};
