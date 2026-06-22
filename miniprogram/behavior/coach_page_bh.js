const pageHelper = require('../helper/page_helper.js');
const AdminWxBiz = require('../biz/admin_wx_biz.js');
module.exports = Behavior({
  data: {
    tenantName: '',
  },

  methods: {
    async _coachOnShow() {
      await AdminWxBiz.ensureSession();
      this.setData({ tenantName: pageHelper.getTenantName() || '瑜伽馆' });
    },

    async bindCoachTenantChange() {
      await AdminWxBiz.ensureSession();
      this.setData({ tenantName: pageHelper.getTenantName() || '瑜伽馆' });
      if (typeof this._loadCoachData === 'function') {
        await this._loadCoachData();
      }
    },

    async _coachBeforeAdmin(url) {
      if (!url || !url.includes('/admin/')) {
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
