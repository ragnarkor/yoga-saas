const AdminBiz = require('../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const themeHelper = require('../../../helper/theme_helper.js');

Component({
  properties: {
    title: {
      type: String,
      value: '教练版',
    },
    themeColor: {
      type: String,
      value: '',
    },
    navBg: {
      type: String,
      value: '',
    },
    showBack: {
      type: Boolean,
      value: false,
    },
    showSwitch: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    tenantName: '',
    roleLabel: '',
    tenantList: [],
    statusBar: 20,
    customBar: 64,
    effectiveShowSwitch: true,
    headerBg: themeHelper.getNavBarBg(themeHelper.DEFAULT_THEME),
  },

  observers: {
    themeColor(color) {
      this._syncHeaderBg(color, this.properties.navBg);
    },
    navBg(val) {
      this._syncHeaderBg(this.properties.themeColor, val);
    },
    'showBack, showSwitch'(showBack, showSwitch) {
      this.setData({ effectiveShowSwitch: !showBack && showSwitch });
    },
  },

  lifetimes: {
    attached() {
      const app = getApp();
      const globalData = app?.globalData || {};
      this.setData({
        statusBar: globalData.statusBar || 20,
        customBar: globalData.customBar || 64,
        effectiveShowSwitch:
          !this.properties.showBack && this.properties.showSwitch,
      });
      this.refresh();
    },
  },

  pageLifetimes: {
    show() {
      this.refresh();
    },
  },

  methods: {
    _syncHeaderBg(themeColor, navBg) {
      let bg = navBg;
      if (!bg && themeColor) {
        bg = themeHelper.getNavBarBg(themeColor);
      }
      if (!bg) {
        bg = themeHelper.getNavBarBg(pageHelper.getThemeColor());
      }
      this.setData({ headerBg: bg });
    },

    async refresh() {
      const list = await AdminWxBiz.fetchTenantList();
      const pid = pageHelper.getPID();
      let current = list.find((t) => t._pid === pid) || list[0];
      this._syncHeaderBg(
        this.properties.themeColor,
        this.properties.navBg,
      );
      this.setData({
        tenantList: list,
        tenantName: current
          ? current.TENANT_NAME
          : pageHelper.getTenantName() || '瑜伽馆',
        roleLabel: current
          ? current.roleLabel
          : AdminWxBiz.isSuperSession()
            ? '超管'
            : '',
      });
    },

    bindBackTap() {
      wx.navigateBack({
        fail: () => {
          wx.redirectTo({ url: '/pages/coach/index/coach_index' });
        },
      });
    },

    bindSwitchTap() {
      const list = this.data.tenantList;
      if (!list.length) {
        if (AdminWxBiz.isSuperSession()) {
          wx.showToast({ title: '暂无瑜伽馆', icon: 'none' });
        } else {
          wx.showToast({ title: '暂无已绑定的馆', icon: 'none' });
        }
        return;
      }
      if (list.length === 1) {
        wx.showToast({ title: '仅有一个馆', icon: 'none' });
        return;
      }

      wx.showActionSheet({
        itemList: list.map(
          (t) => t.TENANT_NAME + '（' + t.roleLabel + '）',
        ),
        success: async (res) => {
          const item = list[res.tapIndex];
          if (!item) return;
          await AdminWxBiz.switchTenant(item);
          this.setData({
            tenantName: item.TENANT_NAME,
            roleLabel: item.roleLabel,
          });
          this.triggerEvent('change', { tenant: item });
        },
      });
    },
  },
});
