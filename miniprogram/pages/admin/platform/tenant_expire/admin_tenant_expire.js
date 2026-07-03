const AdminBiz = require('../../../../biz/admin_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');
const tenantExpireHelper = require('../../../../helper/tenant_expire_helper.js');

Page({
  data: {
    pid: '',
    tenantName: '',
    expireMode: 'long',
    expireDay: '',
    minExpireDay: tenantExpireHelper.todayYMD(),
    loading: true,
    submitting: false,
  },

  onLoad(options) {
    if (!AdminBiz.getAdminToken() || !AdminBiz.isSuperAdmin()) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    const pid = options.pid || '';
    const tenantName = options.name ? decodeURIComponent(options.name) : '';
    this.setData({ pid, tenantName });
    if (pid) this._loadDetail(pid);
    else this.setData({ loading: false });
  },

  async _loadDetail(pid) {
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_expire_detail',
        { pid },
        { hint: false, title: 'bar' },
      );
      const expireMode = res && res.isLongTerm ? 'long' : 'date';
      this.setData({
        loading: false,
        tenantName: (res && res.TENANT_NAME) || this.data.tenantName,
        expireMode,
        expireDay: (res && res.expireDay) || tenantExpireHelper.todayYMD(),
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  bindExpireModeTap(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.expireMode) return;
    this.setData({
      expireMode: mode,
      expireDay: mode === 'date' ? tenantExpireHelper.todayYMD() : '',
    });
  },

  bindExpireDayChange(e) {
    this.setData({ expireDay: e.detail.value });
  },

  async bindSubmit() {
    const { pid, expireMode, expireDay, submitting } = this.data;
    if (!pid || submitting) return;

    this.setData({ submitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/tenant_expire_save',
        {
          pid,
          expireDay: expireMode === 'long' ? 'long' : expireDay,
        },
        { title: '保存中' },
      );
      pageHelper.showSuccToast('已保存', 1200, () => wx.navigateBack());
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
