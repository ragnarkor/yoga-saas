const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");
const adminTheme = require("../../../../helper/admin_theme.js");

Page({
  data: {
    adminLoginShow: false,
  },

  onLoad: async function (options) {
    const needLogin = !AdminBiz.getAdminToken();
    if (needLogin || (options && options.login === "1")) {
      this.setData({ adminLoginShow: true });
    }
    if (needLogin) return;

    wx.setNavigationBarColor({
      backgroundColor: adminTheme.NAV_BG,
      frontColor: "#ffffff",
    });
    this.setData({ isAdmin: true });
    this._loadDetail();
  },

  onPullDownRefresh: async function () {
    await this._loadDetail();
    wx.stopPullDownRefresh();
  },

  _loadDetail: async function () {
    let admin = AdminBiz.getAdminToken();
    if (!admin) return;

    this.setData({
      isLoad: true,
      admin,
    });

    try {
      let opts = {
        title: "bar",
      };
      let res = await cloudHelper.callCloudData("admin/home", {}, opts);
      if (admin.type === "super") {
        const tenantRes = await cloudHelper.callCloudData(
          "tenant/list",
          {},
          { hint: false },
        );
        res = res || {};
        res.tenantList = (tenantRes && tenantRes.list) || [];
      }
      this.setData({
        data: res,
        currentTenantName: pageHelper.getTenantName() || "",
      });
    } catch (err) {
      console.log(err);
    }
  },

  url: function (e) {
    pageHelper.url(e, this);
  },

  bindEnterCoachTap: function (e) {
    let item = e && e.currentTarget ? e.currentTarget.dataset.item : null;
    if (item && item._pid) {
      pageHelper.setTenant(item);
    }
    if (!pageHelper.getPID()) {
      wx.showToast({ title: "请先选择瑜伽馆", icon: "none" });
      return;
    }
    wx.reLaunch({ url: "/pages/coach/index/coach_index" });
  },

  bindAdminLoginCloseTap: function () {
    this.setData({ adminLoginShow: false });
    if (!AdminBiz.getAdminToken()) {
      wx.reLaunch({
        url: pageHelper.fmtURLByPID("/pages/default/my/index/my_index"),
      });
    }
  },

  bindAdminLoginSuccessTap: function () {
    this.setData({ adminLoginShow: false, isAdmin: true });
    wx.setNavigationBarColor({
      backgroundColor: adminTheme.NAV_BG,
      frontColor: "#ffffff",
    });
    this._loadDetail();
  },

  bindExitTap: function (e) {
    let callback = function () {
      AdminBiz.clearAdminToken();
      wx.reLaunch({
        url: pageHelper.fmtURLByPID("/pages/default/my/index/my_index"),
      });
    };
    pageHelper.showConfirm("您确认退出?", callback);
  },

  bindSettingTap: function (e) {
    let itemList = ["清除数据缓存"];
    wx.showActionSheet({
      itemList,
      success: async (res) => {
        switch (res.tapIndex) {
          case 0: {
            await this._clearCache();
            break;
          }
        }
      },
      fail: function (res) {},
    });
  },

  _clearCache: async function () {
    try {
      let opts = {
        title: "数据缓存清除中",
      };
      await cloudHelper
        .callCloudSumbit("admin/clear_cache", {}, opts)
        .then((res) => {
          pageHelper.showSuccToast("清除成功");
        });
    } catch (err) {
      console.error(err);
    }
  },
});
