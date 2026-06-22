const pageHelper = require("../helper/page_helper.js");

/** 会员 Tab 页 onShow 时同步底部栏选中态 */
function createMemberTabBarBh(tabBarIndex) {
  if (tabBarIndex < 0) {
    return Behavior({});
  }
  const index = Number(tabBarIndex);

  function syncTabBar(page) {
    if (!page || typeof page.getTabBar !== "function") return false;
    const tabBar = page.getTabBar();
    if (!tabBar) return false;
    pageHelper.syncMemberTabBar(index, page);
    return true;
  }

  return Behavior({
    pageLifetimes: {
      show() {
        const page = this;
        const trySync = (left = 3) => {
          if (syncTabBar(page) || left <= 0) return;
          wx.nextTick(() => trySync(left - 1));
        };
        wx.nextTick(() => trySync());
      },
    },
  });
}

module.exports = { createMemberTabBarBh };
