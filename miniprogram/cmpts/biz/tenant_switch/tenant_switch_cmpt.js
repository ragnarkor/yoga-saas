const pageHelper = require("../../../helper/page_helper.js");
const cloudHelper = require("../../../helper/cloud_helper.js");
const themeHelper = require("../../../helper/theme_helper.js");

Component({
  properties: {
    title: {
      type: String,
      value: "瑜伽馆预约",
    },
    themeColor: {
      type: String,
      value: "",
    },
    showBack: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    tenantName: "",
    statusBar: 20,
    customBar: 64,
    navBg: themeHelper.DEFAULT_THEME,
  },

  observers: {
    themeColor(color) {
      this._syncNavBg(color);
    },
  },

  lifetimes: {
    attached() {
      const app = getApp();
      const globalData = app?.globalData || {};
      this.setData({
        statusBar: globalData.statusBar || 20,
        customBar: globalData.customBar || 64,
      });
      this.refreshTenant();
    },
  },

  pageLifetimes: {
    show() {
      this.refreshTenant();
    },
  },

  methods: {
    _syncNavBg(color) {
      this.setData({
        navBg: themeHelper.normalizeHex(color || pageHelper.getThemeColor()),
      });
    },

    async refreshTenant() {
      const prevColor = pageHelper.getThemeColor();
      const pid = pageHelper.getPID();
      if (pid) {
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
      }

      const nextColor = pageHelper.getThemeColor();
      this._syncNavBg(this.properties.themeColor || nextColor);
      this.setData({
        tenantName: pageHelper.getTenantName(),
      });

      if (nextColor !== prevColor) {
        themeHelper.applyMemberThemeGlobal();
      }
    },

    bindSwitchTenantTap() {
      wx.navigateTo({
        url: "/pages/tenant/select/tenant_select?switch=1",
      });
    },

    bindBackTap() {
      wx.navigateBack({
        fail: () => {
          wx.switchTab({ url: "/pages/default/index/default_index" });
        },
      });
    },
  },
});
