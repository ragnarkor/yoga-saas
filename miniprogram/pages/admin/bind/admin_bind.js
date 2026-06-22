const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminBiz = require('../../../biz/admin_biz.js');

Page({
  data: {
    code: '',
    loading: true,
    success: false,
    errMsg: '',
    tenantName: '',
    roleLabel: '',
  },

  onLoad(options) {
    const code = (options && options.code) || '';
    this.setData({ code });
    if (code) this._doBind(code);
    else {
      this.setData({
        loading: false,
        errMsg: '缺少绑定码，请使用完整绑定链接打开',
      });
    }
  },

  async _doBind(code) {
    try {
      const res = await cloudHelper.callCloudSumbit(
        'admin/wx_bind',
        { code },
        { title: '绑定中' },
      );
      const data = (res && res.data) || {};
      if (data.token) AdminBiz.adminLogin(data);

      if (data.tenant) {
        pageHelper.setTenant(data.tenant);
      } else if (data.tenantPid || data.pid) {
        pageHelper.setPID(data.tenantPid || data.pid);
      }

      this.setData({
        loading: false,
        success: true,
        tenantName: pageHelper.getTenantName(),
        roleLabel: data.type === 'owner' ? '馆主' : data.type === 'teacher' ? '教练' : '',
      });
    } catch (e) {
      console.error(e);
      this.setData({
        loading: false,
        errMsg: (e && e.msg) || '绑定失败，请确认绑定码是否有效',
      });
    }
  },

  bindGoCoach() {
    wx.redirectTo({ url: '/pages/coach/index/coach_index' });
  },

  bindGoHome() {
    wx.switchTab({ url: '/pages/default/my/index/my_index' });
  },
});
