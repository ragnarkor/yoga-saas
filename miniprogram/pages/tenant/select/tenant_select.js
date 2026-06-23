const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const themeHelper = require("../../../helper/theme_helper.js");

Page({
  data: {
    list: [],
    isLoad: false,
    themeColor: themeHelper.DEFAULT_THEME,
    pageStyle: themeHelper.getPageMetaStyle(themeHelper.DEFAULT_THEME),
  },

  onLoad: function (options) {
    this._applyTheme();
    let pid = pageHelper.getPID();
    if (pid && !options.switch) {
      pageHelper.goMemberTabHome();
      return;
    }
    this._loadList();
  },

  onShow: function () {
    this._applyTheme();
  },

  _applyTheme: function () {
    const color = pageHelper.getThemeColor();
    const pageStyle = themeHelper.getPageMetaStyle(color);
    wx.setNavigationBarColor({
      frontColor: "#ffffff",
      backgroundColor: color,
    });
    this.setData({ themeColor: color, pageStyle });
  },

  _loadList: async function () {
    try {
      let opts = { title: "加载中" };
      let res = await cloudHelper.callCloudData("tenant/list", {}, opts);
      this.setData({
        list: (res && res.list) || [],
        isLoad: true,
      });
    } catch (err) {
      console.log(err);
      this.setData({ isLoad: true });
    }
  },

  bindSelectTap: async function (e) {
    let item = e.currentTarget.dataset.item;
    if (!item || !item._pid) return;

    pageHelper.setTenant(item);

    try {
      await cloudHelper.callCloudSumbit(
        "passport/ensure_member",
        {},
        { hint: false },
      );
    } catch (err) {
      console.error("[tenant/ensure_member]", err);
    }

    wx.showToast({
      title: "已选择「" + item.TENANT_NAME + "」",
      icon: "success",
      duration: 800,
    });

    setTimeout(() => {
      pageHelper.goMemberTabHome();
    }, 800);
  },
});
