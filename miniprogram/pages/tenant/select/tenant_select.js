const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");

Page({
  data: {
    list: [],
    isLoad: false,
  },

  onLoad: function (options) {
    let pid = pageHelper.getPID();
    if (pid && !options.switch) {
      wx.redirectTo({
        url: pageHelper.fmtURLByPID("/pages/index/default_index"),
      });
      return;
    }
    this._loadList();
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

  bindSelectTap: function (e) {
    let item = e.currentTarget.dataset.item;
    if (!item || !item._pid) return;

    pageHelper.setTenant(item);

    wx.showToast({
      title: "已选择「" + item.TENANT_NAME + "」",
      icon: "success",
      duration: 1200,
    });
    setTimeout(() => {
      wx.reLaunch({
        url: pageHelper.fmtURLByPID("/pages/index/default_index"),
      });
    }, 1200);
  },
});
