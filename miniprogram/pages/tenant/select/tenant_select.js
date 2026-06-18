// [AI_START TIMESTAMP=2025-01-25 19:10:00]
const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");

Page({
  data: {
    list: [],
    isLoad: false,
  },

  onLoad: function (options) {
    // [AI_START TIMESTAMP=2025-01-25 21:15:00]
    // 已选过馆且非手动切换 → 直接跳首页（动态路由：普通→pages/default，A001→projects/A00）
    let pid = pageHelper.getPID();
    if (pid && !options.switch) {
      wx.redirectTo({
        url: pageHelper.fmtURLByPID("/pages/default/index/default_index"),
      });
      return;
    }
    // [AI_END LINES=7 TIMESTAMP=2025-01-25 21:15:00]
    this._loadList();
  },

  _loadList: async function () {
    try {
      let opts = { title: "加载中" };
      let res = await cloudHelper.callCloudData("tenant/list", {}, opts);
      this.setData({
        list: res.list || [],
        isLoad: true,
      });
    } catch (err) {
      console.log(err);
      this.setData({ isLoad: true });
    }
  },

  bindSelectTap: function (e) {
    let pid = e.currentTarget.dataset.pid;
    let name = e.currentTarget.dataset.name;
    if (!pid) return;

    pageHelper.setPID(pid);
    wx.showToast({
      title: "已选择「" + name + "」",
      icon: "success",
      duration: 1200,
    });
    // [AI_START TIMESTAMP=2025-01-25 21:15:00]
    setTimeout(() => {
      wx.reLaunch({
        url: pageHelper.fmtURLByPID("/pages/default/index/default_index"),
      });
    }, 1200);
    // [AI_END LINES=1 TIMESTAMP=2025-01-25 21:15:00]
  },
});
// [AI_END LINES=43 TIMESTAMP=2025-01-25 19:10:00]
