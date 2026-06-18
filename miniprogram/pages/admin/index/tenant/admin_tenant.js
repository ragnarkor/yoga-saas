// [AI_START TIMESTAMP=2025-01-25 19:30:00]
const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");

Page({
  /**
   * 页面的初始数据
   */
  data: {
    tenantList: [],
    loading: true,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this._loadTenantList();
  },

  /**
   * 加载馆列表
   */
  _loadTenantList: async function () {
    try {
      let res = await cloudHelper.callCloudData("tenant/list", {});
      if (res && res.list) {
        this.setData({
          tenantList: res.list,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.log(err);
      this.setData({ loading: false });
    }
  },

  /**
   * 选择馆
   */
  bindSelectTap: function (e) {
    let pid = e.currentTarget.dataset.pid;
    let name = e.currentTarget.dataset.name;

    if (!pid) return;

    pageHelper.setPID(pid);

    wx.showToast({
      title: "已选择「" + name + "」",
      icon: "none",
      duration: 1000,
    });

    setTimeout(() => {
      wx.redirectTo({
        url: "/pages/admin/index/login/admin_login",
      });
    }, 1000);
  },

  /**
   * 刷新列表
   */
  bindRefreshTap: function () {
    this.setData({ loading: true });
    this._loadTenantList();
  },
});
// [AI_END LINES=64 TIMESTAMP=2025-01-25 19:30:00]
