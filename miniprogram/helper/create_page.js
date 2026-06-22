const pageHelper = require("./page_helper.js");
const PassportBiz = require("../biz/passport_biz.js");
const themeHelper = require("./theme_helper.js");
const behaviors = require("./behaviors.js");
const themeBh = require("../behavior/theme_bh.js");

/**
 * 前台页面工厂：统一 behavior + skin
 * 勿在 Page 上定义 onLoad，否则会覆盖 behavior.methods.onLoad（如约课页初始化）
 */
// [AI_START TIMESTAMP=2026-06-22 14:49:41]
function createPage(options) {
  const {
    behaviorKey,
    tabIndex = -1,
    tabBarIndex = -1,
    isLoadSkin = false,
    isModifyNavColor = true,
  } = options;

  const behavior = behaviors[behaviorKey];
  if (!behavior) {
    console.error("[createPage] unknown behaviorKey:", behaviorKey);
    return;
  }

  const skin = pageHelper.getSkin();
  const themeColor = pageHelper.getThemeColor();

  // 关键：不在 Page 上定义 onShow / onHide / onPullDownRefresh / onLoad，
  // 否则会覆盖 behavior.methods 中的同名生命周期方法，导致数据加载逻辑（如
  // _loadUser）永远不会被调用。这些生命周期方法全部由 behavior 提供，
  // 框架在 Page 未定义同名方法时会自动调用 behavior 的版本。
  //
  // tab 栏选中状态由 custom-tab-bar 组件的 pageLifetimes.show → refreshTabs
  // 根据当前页面路由自动管理，无需在此手动 setData。
  Page({
    data: {
      skin,
      themeColor,
      pageStyle: themeHelper.getPageMetaStyle(themeColor),
    },
    behaviors: [behavior, themeBh],
    onReady() {
      PassportBiz.initPage({
        skin: pageHelper.getSkin(),
        that: this,
        isLoadSkin,
        tabIndex,
        isModifyNavColor,
      });
      if (typeof this._applyTheme === "function") {
        this._applyTheme();
      }
    },
  });
}
// [AI_END LINES=34 TIMESTAMP=2026-06-22 14:49:41]

module.exports = { createPage };
