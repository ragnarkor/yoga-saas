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

/** 12 列 × 7 行：col=周(0..11)，row=星期(0=日..6=六) */
function buildHeatmapRows(startDay, heatmap) {
  // 从「今天所在周的周日」往前推 11 周，共 12 列
  const todaySunday = alignToSunday(todayYMD());
  const baseDay = alignToSunday(startDay || addDays(todaySunday, -77));
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  return labels.map((label, row) => ({
    label,
    cells: Array.from({ length: 12 }, (_, col) => {
      const date = addDays(baseDay, col * 7 + row);
      return {
        date,
        on: !!(date && heatmap && heatmap[date]),
      };
    }),
  }));
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
    heatmapTip: "",
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
        heatmapHint: "成就数据加载失败，请下拉刷新；若仍为空请确认云函数已部署",
      });
    }
  },

  bindHeatmapCellTap(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    const on = !!e.currentTarget.dataset.on;
    this.setData({
      heatmapTip: on ? `${date} 已上课` : `${date} 未上课`,
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
