const cloudHelper = require("../../../helper/cloud_helper.js");
const pageHelper = require("../../../helper/page_helper.js");
const themeHelper = require("../../../helper/theme_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
Page({
  data: {
    list: [],
    isLoad: false,
    scope: "member",
    reason: "",
    expiredBanner: "",
    emptyDesc: "暂无可用瑜伽馆",
    themeColor: themeHelper.DEFAULT_THEME,
    themeColorSoft: themeHelper.getThemeAlphaBg(themeHelper.DEFAULT_THEME),
    pageStyle: themeHelper.getPageMetaStyle(themeHelper.DEFAULT_THEME),
  },
  onLoad(options) {
    this._scope = options.scope === "coach" ? "coach" : "member";
    this._reason = options.reason || "";
    let decodedColor = "";
    if (options.color) {
      try {
        decodedColor = decodeURIComponent(options.color);
      } catch (e) {
        decodedColor = "";
      }
    }
    this._themeColor = decodedColor
      ? themeHelper.normalizeHex(decodedColor)
      : "";
    const expiredBanner =
      this._reason === "expired"
        ? this._scope === "coach"
          ? "当前瑜伽馆已到期，请选择你有权限管理的其他场馆"
          : "当前瑜伽馆已到期，请选择其他瑜伽馆"
        : "";
    this.setData({
      scope: this._scope,
      reason: this._reason,
      expiredBanner,
      emptyDesc:
        this._scope === "coach"
          ? "暂无可用瑜伽馆，请联系平台续期"
          : "暂无可用瑜伽馆",
    });
    this._applyTheme();
    const pid = pageHelper.getPID();
    if (pid && !options.switch && this._scope === "member") {
      pageHelper.goMemberTabHome();
      return;
    }
    this._loadList();
  },
  onShow() {
    if (typeof wx.hideHomeButton === "function") {
      wx.hideHomeButton();
    }
    this._applyTheme();
  },
  // 下拉刷新场馆列表（场馆到期被引导至此页时，管理员续期后可直接下拉重取列表）
  async onPullDownRefresh() {
    try {
      await this._loadList(true);
    } finally {
      wx.stopPullDownRefresh();
    }
  },
  _applyTheme() {
    const color = this._themeColor || pageHelper.getThemeColor();
    this.setData({
      themeColor: color,
      themeColorSoft: themeHelper.getThemeAlphaBg(color),
      pageStyle: themeHelper.getPageMetaStyle(color),
    });
  },
  _loadList: async function (silent = false) {
    const currentPid = pageHelper.getPID();
    try {
      if (this._scope === "coach") {
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) {
          this.setData({ list: [], isLoad: true });
          return;
        }
        const list = await AdminWxBiz.fetchTenantList();
        this.setData({
          list: this._markCurrent(list || [], currentPid),
          isLoad: true,
        });
        return;
      }
      const res = await cloudHelper.callCloudData(
        "tenant/list",
        {},
        silent ? { hint: false } : { title: "加载中" },
      );
      this.setData({
        list: this._markCurrent((res && res.list) || [], currentPid),
        isLoad: true,
      });
    } catch (err) {
      console.log(err);
      wx.showToast({ title: "加载失败,请重试", icon: "none" });
      this.setData({ isLoad: true, list: [] });
    }
  },
  // 标记当前所在租户（若能从本地上下文识别到），用于列表高亮展示
  _markCurrent: function (list, currentPid) {
    if (!currentPid || !Array.isArray(list)) return list || [];
    return list.map((item) => ({
      ...item,
      isCurrent: !!(item && item._pid === currentPid),
    }));
  },
  bindSelectTap: async function (e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item._pid) return;
    if (this._scope === "coach") {
      await AdminWxBiz.switchTenant(item);
      wx.showToast({
        title: "已选择「" + item.TENANT_NAME + "」",
        icon: "none",
        duration: 800,
      });
      setTimeout(() => {
        wx.reLaunch({ url: "/pages/coach/index/coach_index" });
      }, 800);
      return;
    }
    pageHelper.setTenant(item);
    try {
      await cloudHelper.callCloudSumbit(
        "passport/ensure_member",
        {},
        { hint: false },
      );
    } catch (err) {
      console.error("[tenant/ensure_member]", err);
    }
    wx.showToast({
      title: "已选择「" + item.TENANT_NAME + "」",
      icon: "success",
      duration: 800,
    });
    setTimeout(() => {
      pageHelper.goMemberTabHome();
    }, 800);
  },
});
