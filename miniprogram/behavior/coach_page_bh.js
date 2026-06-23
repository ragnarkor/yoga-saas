const pageHelper = require('../helper/page_helper.js');
const AdminWxBiz = require('../biz/admin_wx_biz.js');
const themeHelper = require('../helper/theme_helper.js');

module.exports = Behavior({
  data: {
    tenantName: '',
    themeColor: themeHelper.DEFAULT_THEME,
    themeNavBg: themeHelper.getNavBarBg(themeHelper.DEFAULT_THEME),
    themeStyle: themeHelper.getCoachPageStyle(themeHelper.DEFAULT_THEME),
  },

  pageLifetimes: {
    show() {
      this._applyCoachTheme();
      this._coachOnShow();
    },
  },

  methods: {
    _applyCoachTheme(color) {
      const app = getApp();
      const navHeight = (app && app.globalData && app.globalData.customBar) || 64;
      const themeColor = themeHelper.normalizeHex(
        color || pageHelper.getThemeColor(),
      );
      const navBg = themeHelper.getNavBarBg(themeColor);
      this.setData({
        themeColor,
        themeNavBg: navBg,
        themeStyle: themeHelper.getCoachPageStyle(themeColor, navHeight),
      });
    },

    async _coachOnShow() {
      await AdminWxBiz.ensureSession();
      this.setData({ tenantName: pageHelper.getTenantName() || '瑜伽馆' });
    },

    async bindCoachTenantChange() {
      await AdminWxBiz.ensureSession();
      this.setData({ tenantName: pageHelper.getTenantName() || '瑜伽馆' });
      this._applyCoachTheme();
      if (typeof this._loadCoachData === 'function') {
        await this._loadCoachData();
      }
    },

    async _coachBeforeAdmin(url) {
      if (!url || !url.includes('/admin/')) {
        return true;
      }
      if (AdminWxBiz.isSuperSession()) {
        return true;
      }
      const ok = await AdminWxBiz.ensureSession();
      if (!ok) {
        wx.showToast({ title: '请先完成微信绑定', icon: 'none' });
        return false;
      }
      return true;
    },
  },
});
