const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");

Page({
  data: {
    tenantList: [],
    loading: true,
  },

  onLoad: function () {
    this._loadTenantList();
  },

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

  bindSelectTap: function (e) {
    let item = e.currentTarget.dataset.item;
    if (!item || !item._pid) return;

    pageHelper.setTenant(item);

    wx.showToast({
      title: "已选择「" + item.TENANT_NAME + "」",
      icon: "none",
      duration: 1000,
    });

    setTimeout(() => {
      wx.redirectTo({
        url: "/pages/admin/index/login/admin_login",
      });
    }, 1000);
  },

  bindRefreshTap: function () {
    this.setData({ loading: true });
    this._loadTenantList();
  },
});
