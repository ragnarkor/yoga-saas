const pageHelper = require("../../../helper/page_helper.js");
const themeHelper = require("../../../helper/theme_helper.js");

Page({
  data: {
    tenantName: "",
    role: "member",
    themeColor: themeHelper.DEFAULT_THEME,
    themeColorSoft: themeHelper.getThemeAlphaBg(themeHelper.DEFAULT_THEME),
    pageStyle: themeHelper.getPageMetaStyle(themeHelper.DEFAULT_THEME),
  },

  onLoad(options) {
    let tenantName = "";
    if (options.name) {
      try {
        tenantName = decodeURIComponent(options.name);
      } catch (e) {
        tenantName = "";
      }
    }
    const role = options.role === "coach" ? "coach" : "member";
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
    this.setData({ tenantName, role });
    this._applyTheme();
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

  bindReselectTap() {
    const scope = this.data.role === "coach" ? "&scope=coach" : "";
    const color = encodeURIComponent(this.data.themeColor);
    wx.reLaunch({
      url: `/pages/tenant/select/tenant_select?switch=1&reason=expired${scope}&color=${color}`,
    });
  },

  bindCoachAdminTap() {
    wx.reLaunch({ url: "/pages/admin/index/home/admin_home" });
  },
});
