const cloudHelper = require("../../../../helper/cloud_helper.js");
const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");

Page({
  data: {
    isLoad: false,
    activeTab: 0,
    banners: [],
    announces: [],
    photos: [],
  },

  onLoad() {
    if (!AdminBiz.isAdmin(this)) return;
  },

  onShow() {
    this._loadAll();
  },

  async _loadAll() {
    try {
      let [banners, announces, photos] = await Promise.all([
        cloudHelper.callCloudData("admin/home_banner_list", {}),
        cloudHelper.callCloudData("admin/home_announce_list", {}),
        cloudHelper.callCloudData("admin/home_photo_list", {}),
      ]);
      this.setData({
        isLoad: true,
        banners: (banners && banners.list) || [],
        announces: (announces && announces.list) || [],
        photos: (photos && photos.list) || [],
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  bindTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  async bindDelTap(e) {
    let { type, id } = e.currentTarget.dataset;
    let routeMap = {
      banner: "admin/home_banner_del",
      announce: "admin/home_announce_del",
      photo: "admin/home_photo_del",
    };
    let route = routeMap[type];
    if (!route || !id) return;

    let ok = await pageHelper.showConfirm("确认删除该项？");
    if (!ok) return;

    try {
      await cloudHelper.callCloudSumbit(route, { id }, { title: "删除中" });
      pageHelper.showSuccToast("已删除");
      this._loadAll();
    } catch (err) {
      console.error(err);
    }
  },
});
