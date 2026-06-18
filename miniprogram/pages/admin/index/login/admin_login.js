// [AI_START TIMESTAMP=2025-01-25 19:45:00]
const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");
const PassportBiz = require("../../../../biz/passport_biz.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");

Page({
  /**
   * 页面的初始数据
   */
  data: {
    phone: "",
    pwd: "",
    tenantName: "",
    pid: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    AdminBiz.clearAdminToken();

    let pid = pageHelper.getPID();
    if (!pid) {
      // 未选择馆，跳转到选馆页
      wx.redirectTo({
        url: "/pages/admin/index/tenant/admin_tenant",
      });
      return;
    }

    this.setData({ pid });
    this._loadTenantInfo(pid);
  },

  /**
   * 加载馆信息
   */
  _loadTenantInfo: async function (pid) {
    try {
      let res = await cloudHelper.callCloudData("tenant/detail", { pid });
      if (res && res.tenant) {
        this.setData({
          tenantName: res.tenant.TENANT_NAME || "未知场馆",
        });
      }
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * 切换馆
   */
  bindSwitchTenantTap: function (e) {
    wx.redirectTo({
      url: "/pages/admin/index/tenant/admin_tenant",
    });
  },

  url: function (e) {
    pageHelper.url(e, this);
  },

  bindFormChange: function (e) {
    let field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail });
  },

  bindBackTap: function (e) {
    wx.reLaunch({
      url: pageHelper.fmtURLByPID("/pages/my/index/my_index"),
    });
  },

  bindLoginTap: async function (e) {
    return PassportBiz.adminLogin(this.data.phone, this.data.pwd, this);
  },
});
// [AI_END LINES=72 TIMESTAMP=2025-01-25 19:45:00]
