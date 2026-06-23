const AdminBiz = require("../../../biz/admin_biz.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const UserProfileBiz = require("../../../biz/user_profile_biz.js");

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    tenantName: "",
    userName: "馆主",
    avatarSrc: "",
    showAvatar: false,
    roleTag: "馆主",
    adminLoginShow: false,
    adminLoginMode: "coach",
    adminLoginRedirect: "none",
    menus: [
      { name: "我的门店", url: "/pages/coach/store/coach_store" },
      { name: "门店公告", url: "/pages/admin/home/content/admin_home_content" },
      { name: "微信绑定码", url: "/pages/admin/mgr/bind/admin_mgr_bind" },
      { name: "用户指南", url: "/pages/default/about/index/about_index" },
    ],
  },

  onShow() {
    this._coachOnShow();
    this._loadProfile();
    this._loadAdmin();
  },

  async _loadProfile() {
    const user = await UserProfileBiz.fetch();

    let avatarSrc = "";
    if (user && user.USER_PIC) {
      avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
    }
    this.setData({
      userName: (user && user.USER_NAME) || "馆主",
      avatarSrc,
      showAvatar: !!avatarSrc,
    });
  },

  _loadAdmin() {
    const admin = AdminBiz.getAdminToken();
    if (admin && admin.name) {
      let roleTag = "馆主";
      if (admin.type === "teacher") roleTag = "教练";
      if (admin.type === "super") roleTag = "超级管理员";
      this.setData({ userName: admin.name, roleTag });
    }
  },

  async onMenuTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: "功能开发中", icon: "none" });
      return;
    }
    if (!(await this._coachBeforeAdmin(url))) return;
    wx.navigateTo({ url });
  },

  onSwitchMember() {
    wx.switchTab({ url: "/pages/default/my/index/my_index" });
  },

  onUnbindWx() {
    if (AdminWxBiz.isSuperSession()) {
      wx.showToast({ title: "超管无需微信绑定", icon: "none" });
      return;
    }
    wx.showModal({
      title: "解除微信绑定",
      content:
        "将解除您在当前馆的教练/馆主微信绑定，解除后需重新使用绑定码才能进入教练版管理功能。",
      confirmText: "确认解绑",
      confirmColor: "#e54d42",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await AdminWxBiz.unbind();
          wx.showToast({ title: "已解绑", icon: "success" });
          setTimeout(() => {
            wx.switchTab({ url: "/pages/default/my/index/my_index" });
          }, 800);
        } catch (e) {
          console.error(e);
        }
      },
    });
  },

  onLogout() {
    AdminBiz.clearAdminToken();
    wx.showToast({ title: "已退出当前会话", icon: "none" });
    if (!AdminWxBiz.isSuperSession()) {
      this.setData({ roleTag: "馆主", userName: "馆主" });
    }
  },

  onAdminLogin() {
    if (AdminWxBiz.isSuperSession()) {
      wx.reLaunch({ url: "/pages/admin/index/home/admin_home" });
      return;
    }
    this.setData({
      adminLoginShow: true,
      adminLoginMode: "coach",
      adminLoginRedirect: "none",
    });
  },

  onPlatformAdmin() {
    if (AdminWxBiz.isSuperSession()) {
      wx.reLaunch({ url: "/pages/admin/index/home/admin_home" });
      return;
    }
    this.setData({
      adminLoginShow: true,
      adminLoginMode: "platform",
      adminLoginRedirect: "admin_home",
    });
  },

  bindAdminLoginCloseTap() {
    this.setData({ adminLoginShow: false });
  },

  async bindAdminLoginSuccessTap() {
    await AdminWxBiz.prepareCoachEntry();
    await this._coachOnShow();
    this._loadAdmin();
  },
});
