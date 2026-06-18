const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
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
  },

  methods: {
    onLoad: async function (options) {
      if (setting.IS_SUB) wx.hideHomeButton();

      this._initTabs();
      this._initDateList();
      await this._loadHasList();
      await this._loadList();
    },

    _initTabs: function () {
      let skin = pageHelper.getSkin();
      let meetTypeStr = skin.MEET_TYPE || "";
      let tabs = [{ id: "0", name: "全部课程" }];
      let parts = meetTypeStr.split(",");
      for (let part of parts) {
        let keyValue = part.split("|")[0];
        let arr = keyValue.split("=");
        if (arr.length >= 2) {
          tabs.push({
            id: arr[0].trim(),
            name: arr[1].trim(),
          });
        }
      }
      if (tabs.length === 1) {
        tabs[0].name = "全部课程";
      }

      let now = new Date();
      let month = now.getMonth() + 1;
      let pageTitle = month + "月瑜伽·普拉提";

      this.setData({
        tabs,
        pageTitle,
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
        this.setData({
          courseList: null,
        });
        const res = await cloudHelper.callCloudSumbit(
          "meet/list_by_day",
          params,
          opts,
        );
        const rawList = (res && res.data) ? res.data : [];
        const courseList = this._transformCourseData(rawList);
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

    _transformCourseData: function (rawList) {
      if (!rawList) return [];

      let activeTabId = this.data.tabs[this.data.activeTab]
        ? this.data.tabs[this.data.activeTab].id
        : "0";

      let result = rawList.map((item) => {
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

        const skin = pageHelper.getSkin();
        const defaultCover =
          skin.IMG_DEFAULT_COVER || "/images/default_cover_pic.gif";

        return {
          _id: item._id,
          title: item.title || "未命名课程",
          typeName: item.typeName || "",
          typeId: item.typeId || "",
          timeStart,
          timeEnd,
          duration,
          coachName: item.coachName || "专业教练",
          coachAvatar: pageHelper.fmtImgUrl(item.coachAvatar || item.pic) || defaultCover,
          slots: slots === 99 ? "不限" : slots,
          status,
          level: item.level || "",
          pic: pageHelper.fmtImgUrl(item.pic),
        };
      });

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
      const today = timeHelper.time("Y-M-D");
      this.setData(
        {
          day: today,
          selectedDate: today,
        },
        async () => {
          await this._loadHasList();
          await this._loadList();
        },
      );
    },

    onHide: function () {},

    onUnload: function () {},

    onPullDownRefresh: async function () {
      await this._loadHasList();
      await this._loadList();
      wx.stopPullDownRefresh();
    },

    onShareAppMessage: function () {},

    bindTabChange: function (e) {
      const activeTab = e.detail.index;
      const courseList = this._transformCourseData(this.data.list);
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
      await this._loadHasList();
      await this._loadList();
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
