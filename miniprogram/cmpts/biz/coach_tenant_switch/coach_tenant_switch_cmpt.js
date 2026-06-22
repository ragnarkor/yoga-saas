const pageHelper = require('../../../helper/page_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Component({
  properties: {
    title: {
      type: String,
      value: '教练版',
    },
    navBg: {
      type: String,
      value: '#5b8a72',
    },
  },

  data: {
    tenantName: '',
    roleLabel: '',
    tenantList: [],
    statusBar: 20,
    customBar: 64,
  },

  lifetimes: {
    attached() {
      const app = getApp();
      const globalData = app?.globalData || {};
      this.setData({
        statusBar: globalData.statusBar || 20,
        customBar: globalData.customBar || 64,
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
    async refresh() {
      const list = await AdminWxBiz.fetchTenantList();
      const pid = pageHelper.getPID();
      let current = list.find((t) => t._pid === pid) || list[0];
      this.setData({
        tenantList: list,
        tenantName: current ? current.TENANT_NAME : pageHelper.getTenantName(),
        roleLabel: current ? current.roleLabel : '',
      });
    },

    bindSwitchTap() {
      const list = this.data.tenantList;
      if (!list.length) {
        wx.showToast({ title: '暂无已绑定的馆', icon: 'none' });
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
