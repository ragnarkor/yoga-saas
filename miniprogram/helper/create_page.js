const pageHelper = require("./page_helper.js");
const PassportBiz = require("../biz/passport_biz.js");
const behaviors = require("./behaviors.js");

/**
 * 前台页面工厂：统一 behavior + skin
 * 勿在 Page 上定义 onLoad，否则会覆盖 behavior.methods.onLoad（如约课页初始化）
 */
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
  const behaviorData = behavior.data || {};
  Page({
    data: Object.assign({}, behaviorData, { skin }),
    behaviors: [behavior],
    onReady() {
      PassportBiz.initPage({
        skin: pageHelper.getSkin(),
        that: this,
        isLoadSkin,
        tabIndex,
        isModifyNavColor,
      });
    },
    onShow() {
      const bhOnShow = behavior.methods && behavior.methods.onShow;
      if (bhOnShow) bhOnShow.call(this);

      if (tabBarIndex < 0) return;
      if (typeof this.getTabBar !== "function") return;
      const tabBar = this.getTabBar();
      if (tabBar) {
        tabBar.setData({ selected: tabBarIndex });
      }
    },
  });
}

module.exports = { createPage };
