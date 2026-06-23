const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");
const adminTheme = require("../../../../helper/admin_theme.js");

Page({
  data: {
    adminLoginShow: false,
    platformTab: 0,
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

  onShow() {
    if (AdminBiz.getAdminToken() && this.data.isLoad) {
      this._loadDetail();
    }
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
        const overview = await cloudHelper.callCloudData(
          "admin/platform_overview",
          {},
          { hint: false },
        );
        res = res || {};
        res.tenantList = (overview && overview.tenantList) || [];
        res.tenantCount = (overview && overview.tenantCount) || 0;
        res.adminCount = (overview && overview.adminCount) || 0;
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

  onPlatformTabTap: function (e) {
    const tab = Number(e.currentTarget.dataset.tab) || 0;
    if (tab !== this.data.platformTab) {
      this.setData({ platformTab: tab });
    }
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

  bindStaffManageTap: function () {
    wx.navigateTo({ url: "/pages/admin/platform/staff/admin_platform_staff" });
  },

  bindPlatformTenantTabTap: function () {
    this.setData({ platformTab: 1 });
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

  bindSettingTap: function () {
    pageHelper.showConfirm("确认清除数据缓存？", () => this._clearCache());
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
