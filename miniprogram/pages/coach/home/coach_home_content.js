const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");

const TAB_TYPES = ["banner", "announce"];

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    isLoad: false,
    activeTab: 0,
    tabs: [
      { id: "banner", name: "横幅", icon: "photo-o" },
      { id: "announce", name: "公告", icon: "volume-o" },
    ],
    banners: [],
    announces: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._ensureAccess();
  },

  onShow() {
    this._loadAll();
  },

  onPullDownRefresh() {
    this._loadAll().finally(() => wx.stopPullDownRefresh());
  },

  async _ensureAccess() {
    if (AdminWxBiz.isSuperSession()) return;
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      wx.showToast({ title: "请先完成教练端登录", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  bindTabTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.activeTab) return;
    this.setData({ activeTab: index });
  },

  async _loadAll() {
    try {
      const [banners, announces] = await Promise.all([
        cloudHelper.callCloudData("admin/home_banner_list", {}),
        cloudHelper.callCloudData("admin/home_announce_list", {}),
      ]);
      this.setData({
        isLoad: true,
        banners: (banners && banners.list) || [],
        announces: (announces && announces.list) || [],
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  async bindDelTap(e) {
    const { type, id } = e.currentTarget.dataset;
    const routeMap = {
      banner: "admin/home_banner_del",
      announce: "admin/home_announce_del",
    };
    const route = routeMap[type];
    if (!route || !id) return;

    const ok = await pageHelper.showConfirm("确认删除该项？");
    if (!ok) return;

    try {
      await cloudHelper.callCloudSumbit(route, { id }, { title: "删除中" });
      pageHelper.showSuccToast("已删除");
      await this._loadAll();
    } catch (err) {
      console.error(err);
    }
  },

  bindAddTap(e) {
    const type = e.currentTarget.dataset.type || TAB_TYPES[this.data.activeTab];
    if (type === "announce") return wx.navigateTo({ url: "/pages/coach/home/coach_announce_edit" });
    if (type === "banner") return wx.navigateTo({ url: "/pages/coach/home/coach_banner_edit" });
  },

  bindEditTap(e) {
    const { type, id } = e.currentTarget.dataset;
    if (type === "announce") {
      wx.navigateTo({ url: "/pages/coach/home/coach_announce_edit?id=" + encodeURIComponent(id) });
      return;
    }
    if (type === "banner") {
      wx.navigateTo({ url: "/pages/coach/home/coach_banner_edit?id=" + encodeURIComponent(id) });
      return;
    }
  },

  bindSwipeOpen(e) {
    const id = e.currentTarget.dataset.swipeId;
    if (this._openSwipeId && this._openSwipeId !== id) {
      const old = this.selectComponent(`#home-swipe-${this._openSwipeId}`);
      if (old) old.close();
    }
    this._openSwipeId = id;
  },

});
