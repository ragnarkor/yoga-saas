const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");

Page({
  data: {
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
    list: [],
    loading: true,
  },

  onLoad() {
    this._loadList();
  },

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },

  async _loadList() {
    this.setData({ loading: true });
    try {
      const data = await cloudHelper.callCloudData(
        "home/index",
        {},
        { hint: false, title: "bar" },
      );
      this.setData({
        list: (data && data.announcements) || [],
        loading: false,
      });
    } catch (err) {
      console.error(err);
      this.setData({ list: [], loading: false });
    }
  },

  bindItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url:
        "/pages/default/announcement/detail/announcement_detail?id=" + id,
    });
  },

  url(e) {
    pageHelper.url(e, this);
  },
});
