const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");
const themeBh = require("../../../../behavior/theme_bh.js");
const UserProfileBiz = require("../../../../biz/user_profile_biz.js");
const achievementPosterHelper = require("../../../../helper/achievement_poster_helper.js");
const achievementAssetHelper = require("../../../../helper/achievement_asset_helper.js");

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(day, offset) {
  const d = new Date(String(day).replace(/-/g, "/") + " 12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** startDay 向前对齐到周日，使每列恰好对应完整的一周（日~六） */
function alignToSunday(day) {
  const d = new Date(String(day).replace(/-/g, "/") + " 12:00:00");
  const dow = d.getDay(); // 0=周日
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function buildMonthCalendar(month, heatmap) {
  const [year, monthNum] = String(month).split("-").map(Number);
  const first = new Date(year, monthNum - 1, 1, 12, 0, 0);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const offset = first.getDay();
  const today = todayYMD();
  return Array.from({ length: 6 }, (_, row) => ({
    cells: Array.from({ length: 7 }, (_, col) => {
      const dayNum = row * 7 + col - offset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return { date: "", day: "" };
      const date = `${year}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      return { date, day: dayNum, on: !!(heatmap && heatmap[date]), isToday: date === today };
    }),
  }));
}

function monthLabel(month) {
  const [year, monthNum] = String(month).split("-");
  return `${year}年${Number(monthNum)}月`;
}

function countMonth(heatmap, month) {
  return Object.keys(heatmap || {}).filter((date) => date.indexOf(`${month}-`) === 0).length;
}

/** 按普通日历阅读方式生成 12 周 × 7 天，避免把星期和月份轴交叉阅读。 */
function buildHeatmapRows(startDay, heatmap) {
  // 从「今天所在周的周日」往前推 11 周，共 12 行
  const todaySunday = alignToSunday(todayYMD());
  const baseDay = alignToSunday(startDay || addDays(todaySunday, -77));
  const today = todayYMD();
  return Array.from({ length: 12 }, (_, week) => {
    const weekStart = addDays(baseDay, week * 7);
    const weekEnd = addDays(weekStart, 6);
    const startText = weekStart ? weekStart.slice(5).replace("-", ".") : "";
    const endText = weekEnd ? weekEnd.slice(5).replace("-", ".") : "";
    return {
      label: `${startText}–${endText}`,
      cells: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        return {
          date,
          day: date ? Number(date.slice(-2)) : "",
          on: !!(date && heatmap && heatmap[date]),
          isToday: date === today,
        };
      }),
    };
  });
}

Page({
  behaviors: [themeBh],

  data: {
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
    isLoad: false,
    heroSrc: achievementAssetHelper.getHeroIllustration(),
    heroEmojis: achievementAssetHelper.buildHeroEmojis(),
    streak: {},
    badges: [],
    unlockedBadgeCount: 0,
    heatmapRows: [],
    heatmapStartDay: "",
    heatmapHint: "",
    heatmapActiveDays: 0,
    calendarMonth: "",
    calendarMonthLabel: "",
    calendarRows: [],
    heatmapMap: {},
    heatmapPopupShow: false,
    selectedHeatmapCell: null,
    badgePopupShow: false,
    activeBadge: null,
    posterLoading: false,
    userName: "",
    avatarSrc: "",
  },

  onLoad() {
    this._applyTheme();
    this._loadDetail();
  },

  onPullDownRefresh() {
    this._loadDetail().finally(() => wx.stopPullDownRefresh());
  },

  async _loadDetail() {
    try {
      const [data, user] = await Promise.all([
        cloudHelper.callCloudData("my/achievement", {}, { hint: false, title: "bar" }),
        UserProfileBiz.fetch(),
      ]);
      let avatarSrc = "";
      if (user && user.USER_PIC) {
        avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
      }
      const heatmapStartDay =
        (data && data.heatmapStartDay) || addDays(todayYMD(), -83);
      const heatmapRows = buildHeatmapRows(
        heatmapStartDay,
        (data && data.heatmap) || {},
      );
      const calendarMonth = todayYMD().slice(0, 7);
      const heatmapActiveDays = countMonth((data && data.heatmap) || {}, calendarMonth);
      const badges = (data && data.badges) || [];
      this.setData({
        isLoad: true,
        streak: (data && data.streak) || {},
        badges,
        unlockedBadgeCount: achievementAssetHelper.countUnlockedBadges(badges),
        heroEmojis: achievementAssetHelper.buildHeroEmojis(badges),
        heatmapRows,
        heatmapStartDay,
        heatmapHint: (data && data.heatmapHint) || "",
        heatmapActiveDays,
        calendarMonth,
        calendarMonthLabel: monthLabel(calendarMonth),
        calendarRows: buildMonthCalendar(calendarMonth, (data && data.heatmap) || {}),
        heatmapMap: (data && data.heatmap) || {},
        userName: (user && user.USER_NAME) || "瑜伽爱好者",
        avatarSrc,
      });
    } catch (e) {
      console.error(e);
      const heatmapStartDay = addDays(todayYMD(), -83);
      this.setData({
        isLoad: true,
        heatmapRows: buildHeatmapRows(heatmapStartDay, {}),
        heatmapStartDay,
        heatmapActiveDays: 0,
        calendarMonth: todayYMD().slice(0, 7),
        calendarMonthLabel: monthLabel(todayYMD().slice(0, 7)),
        calendarRows: buildMonthCalendar(todayYMD().slice(0, 7), {}),
        heatmapMap: {},
        heatmapHint: "成就数据加载失败，请下拉刷新；若仍为空请确认云函数已部署",
      });
    }
  },

  bindHeatmapCellTap(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    const on = !!e.currentTarget.dataset.on;
    this.setData({
      selectedHeatmapCell: { date, on },
      heatmapPopupShow: true,
    });
  },

  bindHeatmapPopupClose() {
    this.setData({ heatmapPopupShow: false });
  },

  bindCalendarMonthTap(e) {
    const offset = Number(e.currentTarget.dataset.offset || 0);
    const [year, month] = this.data.calendarMonth.split("-").map(Number);
    const d = new Date(year, month - 1 + offset, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    this.setData({
      calendarMonth: next,
      calendarMonthLabel: monthLabel(next),
      calendarRows: buildMonthCalendar(next, this.data.heatmapMap),
      heatmapActiveDays: countMonth(this.data.heatmapMap, next),
    });
  },

  bindBadgeTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const badge = this.data.badges[index];
    if (!badge) return;
    this.setData({ badgePopupShow: true, activeBadge: badge });
  },

  bindBadgePopupClose() {
    this.setData({ badgePopupShow: false, activeBadge: null });
  },

  async bindPosterTap() {
    if (this.data.posterLoading) return;
    this.setData({ posterLoading: true });
    wx.showLoading({ title: "生成海报", mask: true });
    try {
      const filePath = await achievementPosterHelper.exportAchievementPoster(
        this,
        {
          userName: this.data.userName,
          avatarSrc: this.data.avatarSrc,
          heroSrc: this.data.heroSrc,
          streak: this.data.streak,
          badges: this.data.badges,
          heatmap: this._flatHeatmap(),
          heatmapStartDay: this.data.heatmapStartDay,
          tenantName: pageHelper.getTenantName(),
          themeColor: this.data.themeColor,
        },
      );
      wx.hideLoading();
      wx.previewImage({ urls: [filePath], current: filePath });
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: "海报生成失败", icon: "none" });
    } finally {
      this.setData({ posterLoading: false });
    }
  },

  async bindSavePosterTap() {
    if (this.data.posterLoading) return;
    this.setData({ posterLoading: true });
    wx.showLoading({ title: "生成中", mask: true });
    try {
      const filePath = await achievementPosterHelper.exportAchievementPoster(
        this,
        {
          userName: this.data.userName,
          avatarSrc: this.data.avatarSrc,
          heroSrc: this.data.heroSrc,
          streak: this.data.streak,
          badges: this.data.badges,
          heatmap: this._flatHeatmap(),
          heatmapStartDay: this.data.heatmapStartDay,
          tenantName: pageHelper.getTenantName(),
          themeColor: this.data.themeColor,
        },
      );
      await achievementPosterHelper.saveToAlbum(filePath);
      wx.hideLoading();
      pageHelper.showSuccToast("已保存到相册");
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      this.setData({ posterLoading: false });
    }
  },

  _flatHeatmap() {
    const map = {};
    for (const row of this.data.heatmapRows || []) {
      for (const cell of row.cells || []) {
        if (cell.date && cell.on) map[cell.date] = 1;
      }
    }
    return map;
  },
});
