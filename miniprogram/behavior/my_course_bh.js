const pageHelper = require("../helper/page_helper.js");
const cloudHelper = require("../helper/cloud_helper.js");
const setting = require("../setting/setting.js");

module.exports = Behavior({
  data: {
    isLoad: false,
    list: [],
    filterTabs: [
      { label: "全部课程", type: "" },
      { label: "已预约", type: "succ" },
      { label: "已签到", type: "checkin" },
      { label: "已取消", type: "cancel" },
    ],
    activeFilter: "",
    page: 1,
    size: 20,
    hasMore: true,
    loading: false,
    emptyText: "暂无课程记录",
  },

  methods: {
    onLoad: function () {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._loadList(true);
    },

    onPullDownRefresh: function () {
      this._loadList(true).finally(() => wx.stopPullDownRefresh());
    },

    onReachBottom: function () {
      if (this.data.hasMore && !this.data.loading) {
        this._loadList(false);
      }
    },

    bindFilterTap: function (e) {
      let type = pageHelper.dataset(e, "type");
      if (type === undefined || type === null) type = "";
      if (type === this.data.activeFilter) return;
      this.setData({ activeFilter: type });
      this._loadList(true);
    },

    bindItemTap: function (e) {
      let id = pageHelper.dataset(e, "id");
      if (!id) return;
      wx.navigateTo({
        url: "/pages/default/my/join_detail/my_join_detail?id=" + id,
      });
    },

    url: function (e) {
      pageHelper.url(e, this);
    },

    _loadList: async function (refresh) {
      if (this.data.loading) return;

      let page = refresh ? 1 : this.data.page + 1;
      this.setData({
        loading: true,
        ...(refresh ? { list: [], isLoad: false, hasMore: true } : {}),
      });

      try {
        let params = {
          page,
          size: this.data.size,
          isTotal: true,
        };
        if (this.data.activeFilter) {
          params.sortType = this.data.activeFilter;
        }

        let res = await cloudHelper.callCloudSumbit("my/my_join_list", params, {
          title: refresh && !this.data.isLoad ? "bar" : "bar",
        });
        let payload = (res && res.data) || {};
        let rawList = payload.list || [];
        let items = this._fmtList(rawList);
        let list = refresh ? items : this.data.list.concat(items);

        this.setData({
          list,
          page,
          hasMore: items.length >= this.data.size,
          isLoad: true,
          loading: false,
        });
      } catch (err) {
        console.error(err);
        this.setData({
          isLoad: true,
          loading: false,
        });
      }
    },

    _fmtList: function (rawList) {
      const skin = pageHelper.getSkin();
      const defaultCover =
        skin.IMG_DEFAULT_COVER || "/images/default_cover_pic.gif";
      const tenantFallback = pageHelper.getTenantName() || "本馆";

      return (rawList || []).map((item) => {
        let tenantName = item.tenantName || tenantFallback;
        let locationText = item.locationText || tenantName;
        return {
          ...item,
          coverPic: pageHelper.fmtImgUrl(item.coverPic) || defaultCover,
          tenantName,
          locationText,
          scheduleText:
            item.JOIN_MEET_DAY +
            " " +
            item.JOIN_MEET_TIME_START +
            "-" +
            item.JOIN_MEET_TIME_END,
        };
      });
    },
  },
});
