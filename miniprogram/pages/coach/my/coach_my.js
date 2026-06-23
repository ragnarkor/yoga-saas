const AdminBiz = require("../../../biz/admin_biz.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const UserProfileBiz = require("../../../biz/user_profile_biz.js");

const BASE_MENUS = [
  { name: "我的门店", url: "/pages/coach/store/coach_store" },
  { name: "首页内容", url: "/pages/admin/home/content/admin_home_content" },
];

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    tenantName: "",
    userName: "馆主",
    avatarSrc: "",
    showAvatar: false,
    roleTag: "馆主",
    isSuperAdmin: false,
    adminLoginShow: false,
    adminLoginMode: "coach",
    adminLoginRedirect: "none",
    menus: BASE_MENUS.slice(),
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
      avatarSrc,
      showAvatar: !!avatarSrc,
    });

    const admin = AdminBiz.getAdminToken();
    if (admin && admin.name && !AdminWxBiz.isSuperSession()) {
      this.setData({ userName: admin.name });
      return;
    }
    if (!AdminWxBiz.isSuperSession()) {
      this.setData({ userName: (user && user.USER_NAME) || "馆主" });
    }
  },

  _buildMenus(admin) {
    const staffUrl = "/pages/coach/staff/coach_staff";
    let menus = BASE_MENUS.slice();
    if (admin && (admin.type === "owner" || admin.type === "teacher")) {
      menus.splice(1, 0, {
        name: "我的主页",
        url: "/pages/coach/profile/coach_profile",
      });
    }
    if (admin && admin.type === "owner") {
      menus.push({ name: "员工管理", url: staffUrl });
    } else if (admin && admin.type === "teacher") {
      menus.push({ name: "我的账号", url: staffUrl });
    }
    return menus;
  },

  _loadAdmin() {
    const admin = AdminBiz.getAdminToken();
    const isSuperAdmin = AdminWxBiz.isSuperSession();

    if (isSuperAdmin) {
      this.setData({
        menus: BASE_MENUS.slice(),
        isSuperAdmin: true,
        roleTag: "超级管理员",
        userName: admin.name || "超级管理员",
      });
      return;
    }

    const menus = admin ? this._buildMenus(admin) : BASE_MENUS.slice();
    let roleTag = "馆主";
    if (admin && admin.type === "teacher") roleTag = "教练";

    this.setData({
      menus,
      isSuperAdmin: false,
      roleTag,
      userName: admin && admin.name ? admin.name : this.data.userName,
    });
  },

  onPlatformTap() {
    if (!AdminWxBiz.isSuperSession()) {
      this.setData({
        adminLoginShow: true,
        adminLoginMode: "coach",
        adminLoginRedirect: "none",
      });
      return;
    }
    wx.navigateTo({ url: "/pages/admin/index/home/admin_home" });
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

  async onLogout() {
    if (AdminWxBiz.isSuperSession()) {
      wx.showLoading({ title: "退出中", mask: true });
      await AdminWxBiz.exitSuperMode();
      wx.hideLoading();
      await this._coachOnShow();
      this._loadAdmin();
      await this._loadProfile();
      wx.showToast({ title: "已退出超管模式", icon: "none" });
      return;
    }

    AdminBiz.clearAdminToken();
    this.setData({
      isSuperAdmin: false,
      roleTag: "馆主",
      menus: BASE_MENUS.slice(),
    });
    await this._loadProfile();
    wx.showToast({ title: "已退出当前会话", icon: "none" });
  },

  onAdminLogin() {
    if (AdminWxBiz.isSuperSession()) {
      wx.showToast({ title: "已登录超管", icon: "none" });
      return;
    }
    this.setData({
      adminLoginShow: true,
      adminLoginMode: "coach",
      adminLoginRedirect: "none",
    });
  },

  bindAdminLoginCloseTap() {
    this.setData({ adminLoginShow: false });
  },

  async bindAdminLoginSuccessTap() {
    await AdminWxBiz.prepareCoachEntry();
    await this._coachOnShow();
    this._loadAdmin();
    await this._loadProfile();
  },
});
