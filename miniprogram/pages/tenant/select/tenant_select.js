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
    this._themeColor = options.color
      ? themeHelper.normalizeHex(decodeURIComponent(options.color))
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

  _applyTheme() {
    const color = this._themeColor || pageHelper.getThemeColor();
    this.setData({
      themeColor: color,
      themeColorSoft: themeHelper.getThemeAlphaBg(color),
      pageStyle: themeHelper.getPageMetaStyle(color),
    });
  },

  _loadList: async function () {
    try {
      if (this._scope === "coach") {
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) {
          this.setData({ list: [], isLoad: true });
          return;
        }
        const list = await AdminWxBiz.fetchTenantList();
        this.setData({ list: list || [], isLoad: true });
        return;
      }

      const res = await cloudHelper.callCloudData(
        "tenant/list",
        {},
        { title: "加载中" },
      );
      this.setData({
        list: (res && res.list) || [],
        isLoad: true,
      });
    } catch (err) {
      console.log(err);
      this.setData({ isLoad: true, list: [] });
    }
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
