// [AI_START TIMESTAMP=2025-01-25 12:30:00]
/**
 * Notes: 智能路由助手
 * Description: 根据当前租户PID，优先导航到定制页面，无定制则走默认页面(projects/A00/)
 *
 * 使用方法：
 *   const routeHelper = require('./route_helper.js');
 *
 *   // 导航到页面（优先定制，否则默认）
 *   routeHelper.navigateTo('default/index/default_index');
 *
 *   // 带参数导航
 *   routeHelper.navigateTo('meet/detail/meet_detail', { id: 'xxx' });
 *
 *   // 获取页面URL（不跳转）
 *   let url = routeHelper.resolvePageURL('default/index/default_index');
 */

const pageHelper = require("./page_helper.js");
const tenantPages = require("../projects/page_registry.js");

/**
 * 解析页面URL：检查当前租户是否有定制页面
 * @param {string} pagePath - 页面路径，如 'default/index/default_index'
 * @returns {string} 完整URL路径
 */
function resolvePageURL(pagePath) {
  let PID = pageHelper.getPID();

  // 检查该租户是否有定制页面
  if (PID && tenantPages[PID] && tenantPages[PID].indexOf(pagePath) >= 0) {
    return "/projects/" + PID + "/" + pagePath;
  }

  // 默认走 projects/A00/ 路径
  // PID 为空或未注册定制页面时，使用 A00 作为默认基础路径
  let defaultPID = PID || "A00";
  return "/projects/" + defaultPID + "/" + pagePath;
}

/**
 * 拼接查询参数
 * @param {object} params
 * @returns {string}
 */
function buildQuery(params) {
  if (!params) return "";
  let keys = Object.keys(params);
  if (keys.length === 0) return "";
  let query = keys.map(function (k) {
    return k + "=" + params[k];
  });
  return "?" + query.join("&");
}

/**
 * 智能导航：navigateTo（保留当前页）
 * @param {string} pagePath - 页面路径
 * @param {object} params - 查询参数
 */
function navigateTo(pagePath, params) {
  let url = resolvePageURL(pagePath) + buildQuery(params);
  wx.navigateTo({ url: url });
}

/**
 * 智能导航：redirectTo（关闭当前页）
 * @param {string} pagePath - 页面路径
 * @param {object} params - 查询参数
 */
function redirectTo(pagePath, params) {
  let url = resolvePageURL(pagePath) + buildQuery(params);
  wx.redirectTo({ url: url });
}

/**
 * 智能导航：reLaunch（关闭所有页面）
 * @param {string} pagePath - 页面路径
 * @param {object} params - 查询参数
 */
function reLaunch(pagePath, params) {
  let url = resolvePageURL(pagePath) + buildQuery(params);
  wx.reLaunch({ url: url });
}

/**
 * 智能导航：switchTab（TabBar页面）
 * @param {string} pagePath - 页面路径
 */
function switchTab(pagePath) {
  let url = resolvePageURL(pagePath);
  wx.switchTab({ url: url });
}

module.exports = {
  navigateTo: navigateTo,
  redirectTo: redirectTo,
  reLaunch: reLaunch,
  switchTab: switchTab,
  resolvePageURL: resolvePageURL,
};
// [AI_END LINES=76 TIMESTAMP=2025-01-25 12:30:00]
