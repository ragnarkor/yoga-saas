const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
const meetCategoryHelper = require("../helper/meet_category_helper.js");
const defaultCoverHelper = require("../helper/default_cover_helper.js");
const UserProfileBiz = require("../biz/user_profile_biz.js");
const setting = require("../setting/setting.js");
const timeHelper = require("../helper/time_helper.js");

module.exports = Behavior({
  data: {
    isLoad: false,
    courseList: [],
    list: [],

    day: "",
    hasDays: [],
    selectedDate: "",

    activeTab: 0,
    tabs: [],

    dateList: [],

    pageTitle: "约课中心",
    pageSubtitle: "选择课程，开启你的练习之旅",
    emptyText: "暂无预约课程",
    showPrivateEntry: false,
  },

  methods: {
    onLoad: async function (options) {
      if (setting.IS_SUB) wx.hideHomeButton();

      this._skipShowRefresh = true;
      this._initDateList();
      await this._syncTenantCategories();
      this._initTabs();
      this.setData({ isLoad: true });
      await Promise.all([this._loadHasList(), this._loadPrivateMeta()]);
      await this._loadList();
    },

    _syncTenantCategories: async function () {
      const pid = pageHelper.getPID();
      if (!pid) return;
      try {
        const res = await cloudHelper.callCloudData(
          "tenant/detail",
          { pid },
          { hint: false, title: "bar" },
        );
        if (res?.tenant) {
          pageHelper.mergeTenantInfo(res.tenant);
        }
      } catch (err) {
        console.error(err);
      }
    },

    _initTabs: function () {
      const tabs = meetCategoryHelper.getMeetCategories("全部课程");

      let now = new Date();
      let month = now.getMonth() + 1;
      let pageTitle = month + "月瑜伽·普拉提";

      let activeTab = this.data.activeTab || 0;
      const prevTabId =
        this.data.tabs && this.data.tabs[activeTab]
          ? this.data.tabs[activeTab].id
          : "0";
      const nextIdx = tabs.findIndex((t) => t.id === prevTabId);
      if (nextIdx >= 0) activeTab = nextIdx;
      else if (activeTab >= tabs.length) activeTab = 0;

      this.setData({
        tabs,
        pageTitle,
        activeTab: Number(activeTab) || 0,
      });
    },

    _initDateList: function () {
      let weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      let dateList = [];
      let today = new Date();

      for (let i = 0; i < 7; i++) {
        let d = new Date(today);
        d.setDate(today.getDate() + i);

        let year = d.getFullYear();
        let month = d.getMonth() + 1;
        let day = d.getDate();
        let dayStr =
          year +
          "-" +
          String(month).padStart(2, "0") +
          "-" +
          String(day).padStart(2, "0");
        let weekday = weekdays[d.getDay()];

        let label = "";
        if (i === 0) label = "今天";
        else if (i === 1) label = "明天";

        dateList.push({
          day: dayStr,
          weekday: label || weekday,
          dateDay: String(day),
          dateMonth: month + "月",
          hasCourse: false,
        });
      }

      let todayStr = dateList[0].day;
      this.setData({
        dateList,
        selectedDate: todayStr,
        day: todayStr,
      });
    },

    _updateDateHasCourse: function (hasDays) {
      let dateList = this.data.dateList.map((item) => {
        return {
          ...item,
          hasCourse: hasDays.includes(item.day),
        };
      });
      this.setData({ dateList });
    },

    _loadList: async function () {
      let params = {
        day: this.data.day,
      };
      let opts = {
        title: this.data.isLoad ? "bar" : "bar",
      };
      try {
        const res = await cloudHelper.callCloudSumbit(
          "meet/list_by_day",
          params,
          opts,
        );
        const rawList = (res && res.data) ? res.data : [];
        const courseList = await this._transformCourseData(rawList);
        this.setData({
          list: rawList,
          courseList,
          isLoad: true,
        });
      } catch (err) {
        console.error(err);
        this.setData({
          courseList: [],
          isLoad: true,
        });
      }
    },

    _transformCourseData: async function (rawList, activeTab = this.data.activeTab) {
      if (!rawList) return [];

      let activeTabId = this.data.tabs[activeTab]
        ? this.data.tabs[activeTab].id
        : "0";

      let result = await Promise.all(
        rawList.map(async (item) => {
        // 后端已返回 timeStart / timeEnd，直接使用
        let timeStart = item.timeStart || "";
        let timeEnd = item.timeEnd || "";
        let timeDesc = item.timeDesc || timeStart + " ~ " + timeEnd;

        let slots = 0;
        if (item.limit && item.limit > 0) {
          slots = Math.max(
            0,
            item.limit -
              (item.stat && item.stat.succCnt ? item.stat.succCnt : 0),
          );
        } else {
          slots = 99;
        }

        let status = "available";
        if (slots === 0) status = "full";

        let duration = "";
        if (timeStart && timeEnd) {
          duration = this._calcDuration(timeStart, timeEnd);
        }

        const levelNum = Math.min(
          5,
          Math.max(1, Number(item.level) || Number(item.difficulty) || 3),
        );
        const levelStars = [0, 0, 0, 0, 0].map((_, i) => (i < levelNum ? 1 : 0));

        const defaultCover = defaultCoverHelper.pickDefaultCover(item._id);

        let coachAvatar = "";
        if (item.coachAvatar) {
          coachAvatar =
            (await UserProfileBiz.resolveAvatarUrl(item.coachAvatar)) ||
            pageHelper.fmtImgUrl(item.coachAvatar) ||
            "";
        }

        return {
          _id: item._id,
          cardKey: (item._id || '') + '_' + (item.timeMark || timeStart),
          title: item.title || "未命名课程",
          typeName: item.typeName || "",
          typeId: item.typeId || "",
          timeStart,
          timeEnd,
          timeMark: item.timeMark || "",
          duration,
          coachName: item.coachName || "专业教练",
          coachAvatar,
          slots: slots === 99 ? "不限" : slots,
          status,
          level: levelNum,
          levelNum,
          levelStars,
          pic: pageHelper.fmtCoverUrl(item.pic, item._id) || defaultCover,
        };
        }),
      );

      if (activeTabId !== "0") {
        result = result.filter(
          (item) => String(item.typeId) === String(activeTabId),
        );
      }

      return result;
    },

    _calcDuration: function (start, end) {
      try {
        let s = start.split(":");
        let e = end.split(":");
        let sMin = parseInt(s[0]) * 60 + parseInt(s[1]);
        let eMin = parseInt(e[0]) * 60 + parseInt(e[1]);
        let diff = eMin - sMin;
        if (diff > 0) {
          let h = Math.floor(diff / 60);
          let m = diff % 60;
          if (h > 0 && m > 0) return h + "h" + m + "min";
          else if (h > 0) return h + "小时";
          else return m + "分钟";
        }
      } catch (e) {}
      return "";
    },

    _loadHasList: async function () {
      let params = {
        day: timeHelper.time("Y-M-D"),
      };
      let opts = {
        title: "bar",
      };
      try {
        await cloudHelper
          .callCloudSumbit("meet/list_has_day", params, opts)
          .then((res) => {
            let hasDays = res.data || [];
            this.setData({
              hasDays,
            });
            this._updateDateHasCourse(hasDays);
          });
      } catch (err) {
        console.error(err);
      }
    },

    onReady: function () {},

    onShow: async function () {
      if (this._skipShowRefresh) {
        this._skipShowRefresh = false;
        return;
      }

      await this._syncTenantCategories();
      this._initTabs();
      if (!this.data.dateList || !this.data.dateList.length) {
        this._initDateList();
      } else {
        const today = timeHelper.time("Y-M-D");
        this.setData({ day: today, selectedDate: today });
      }

      const prevTabId =
        this.data.tabs && this.data.tabs[this.data.activeTab]
          ? this.data.tabs[this.data.activeTab].id
          : "0";
      let activeTab = this.data.activeTab;
      const idx = (this.data.tabs || []).findIndex((t) => t.id === prevTabId);
      if (idx >= 0) activeTab = idx;

      this.setData({ activeTab: Number(activeTab) || 0 }, async () => {
        await Promise.all([this._loadHasList(), this._loadPrivateMeta()]);
        await this._loadList();
      });
    },

    onHide: function () {},

    onUnload: function () {},

    onPullDownRefresh: async function () {
      await Promise.all([this._loadHasList(), this._loadPrivateMeta()]);
      await this._loadList();
      wx.stopPullDownRefresh();
    },

    onShareAppMessage: function () {},

    bindTabChange: async function (e) {
      const activeTab = e.detail.index;
      const courseList = await this._transformCourseData(this.data.list, activeTab);
      this.setData({ activeTab, courseList });
    },

    bindCategoryTap: async function (e) {
      const activeTab = Number(e.currentTarget.dataset.index);
      if (Number.isNaN(activeTab) || activeTab === Number(this.data.activeTab)) {
        return;
      }
      const courseList = await this._transformCourseData(this.data.list, activeTab);
      this.setData({ activeTab, courseList });
    },

    bindDateSelect: async function (e) {
      let day = e.currentTarget.dataset.day;
      if (day === this.data.selectedDate) return;

      this.setData(
        {
          selectedDate: day,
          day,
        },
        async () => {
          await this._loadList();
        },
      );
    },

    bindReload: async function () {
      await Promise.all([this._loadHasList(), this._loadPrivateMeta()]);
      await this._loadList();
    },

    _loadPrivateMeta: async function () {
      try {
        const meta = await cloudHelper.callCloudData(
          "private/meta",
          {},
          { hint: false },
        );
        const hasPrivate =
          meta && Array.isArray(meta.courses) && meta.courses.length > 0;
        this.setData({ showPrivateEntry: !!hasPrivate });
      } catch (err) {
        console.warn("[calendar/private]", err);
        this.setData({ showPrivateEntry: false });
      }
    },

    bindPrivateBookTap: function () {
      wx.navigateTo({
        url: "/pages/default/private/book/private_book",
      });
    },

    bindClickCmpt: async function (e) {
      let day = e.detail.day;
      this.setData(
        {
          day,
          selectedDate: day,
        },
        async () => {
          await this._loadList();
        },
      );
    },

    bindMonthChangeCmpt: function (e) {
      console.log(e.detail);
    },

    url: async function (e) {
      pageHelper.url(e, this);
    },
  },
});
// [AI_END LINES=203 TIMESTAMP=2025-01-24 12:30:00]
