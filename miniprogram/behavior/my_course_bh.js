const pageHelper = require("../helper/page_helper.js");
const cloudHelper = require("../helper/cloud_helper.js");
const setting = require("../setting/setting.js");
const timeHelper = require("../helper/time_helper.js");

function fmtDateText(day, timeStart, timeEnd) {
  const d = String(day || "");
  const md = d.length >= 10 ? d.slice(5).replace("-", " 月 ") + " 日" : d;
  return md + " " + (timeStart || "") + "-" + (timeEnd || "");
}

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
    activeFilter: "succ",
    page: 1,
    size: 20,
    hasMore: true,
    loading: false,
    emptyText: "暂无课程记录",
    practiceStats: null,
    todayList: [],
    todayPendingCount: 0,
  },

  methods: {
    onLoad: function () {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._loadStats();
      this._loadTodayList();
      this._loadList(true);
    },

    onShow: function () {
      // 从预约详情核销返回后，刷新今日面板与统计。
      if (this.data.isLoad) {
        this._loadTodayList();
        this._loadStats();
      }
    },

    onPullDownRefresh: function () {
      Promise.allSettled([
        this._loadList(true),
        this._loadTodayList(),
        this._loadStats(),
      ]).finally(() => wx.stopPullDownRefresh());
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

    bindTodayTap: function (e) {
      let id = pageHelper.dataset(e, "id");
      if (!id) return;
      wx.navigateTo({
        url: "/pages/default/my/join_detail/my_join_detail?id=" + id,
      });
    },

    bindTodayEmptyTap: function () {
      wx.switchTab({ url: "/pages/default/calendar/index/calendar_index" });
    },

    bindHeroAchievementTap: function () {
      wx.navigateTo({
        url: "/pages/default/my/achievement/my_achievement",
      });
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
        wx.showToast({ title: "加载失败，请重试", icon: "none" });
        this.setData({
          isLoad: true,
          loading: false,
        });
      }
    },

    _loadStats: async function () {
      try {
        const data = await cloudHelper.callCloudData(
          "home/member_dashboard",
          {},
          { hint: false },
        );
        this.setData({ practiceStats: (data && data.progress) || null });
      } catch (err) {
        console.warn("[course/stats]", err);
      }
    },

    _loadTodayList: async function () {
      try {
        const raw = await cloudHelper.callCloudData(
          "my/my_join_someday",
          { day: timeHelper.time("Y-M-D") },
          { hint: false },
        );
        const toMin = (t) => {
          const p = String(t || "").split(":");
          return Number(p[0] || 0) * 60 + Number(p[1] || 0);
        };
        const list = (Array.isArray(raw) ? raw : [])
          .filter((item) => Number(item.JOIN_STATUS) === 1)
          .sort((a, b) =>
            String(a.JOIN_MEET_TIME_START || "").localeCompare(
              String(b.JOIN_MEET_TIME_START || ""),
            ),
          )
          .map((item) => {
            const mins = Math.max(
              0,
              toMin(item.JOIN_MEET_TIME_END) - toMin(item.JOIN_MEET_TIME_START),
            );
            const coach = String(item.coachName || "").trim();
            return {
              ...item,
              durationText: mins ? `${mins} 分钟` : "",
              metaText: coach ? `${coach}教练` : "",
              stateText:
                Number(item.JOIN_IS_CHECKIN) === 1 ? "已签到" : "待上课",
            };
          });
        const pendingCount = list.filter(
          (item) => item.stateText === "待上课",
        ).length;
        this.setData({ todayList: list, todayPendingCount: pendingCount });
      } catch (err) {
        console.warn("[course/today]", err);
      }
    },

    _fmtList: function (rawList) {
      return (rawList || []).map((item) => {
        let locationText = item.locationText || "";
        const seed = item.JOIN_MEET_ID || item._id;
        const status = Number(item.JOIN_STATUS);
        const checkedIn = Number(item.JOIN_IS_CHECKIN) === 1;
        let stateText = checkedIn ? "已签到" : "待上课";
        let stateClass = checkedIn ? "done" : "";
        if (status === 10 || status === 99) {
          stateText = "已取消";
          stateClass = "cancel";
        }
        return {
          ...item,
          coverPic: pageHelper.fmtCoverUrl(item.coverPic, seed),
          locationText,
          stateText,
          stateClass,
          scheduleText:
            item.JOIN_MEET_DAY +
            " " +
            item.JOIN_MEET_TIME_START +
            "-" +
            item.JOIN_MEET_TIME_END,
          dateText: fmtDateText(
            item.JOIN_MEET_DAY,
            item.JOIN_MEET_TIME_START,
            item.JOIN_MEET_TIME_END,
          ),
        };
      });
    },
  },
});
