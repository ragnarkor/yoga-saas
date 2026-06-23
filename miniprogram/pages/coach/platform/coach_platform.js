const AdminBiz = require('../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const pageHelper = require('../../../helper/page_helper.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    tenantList: [],
    stats: { tenantCount: 0, adminCount: 0 },
    adminLoginShow: false,
    adminLoginMode: 'coach',
    adminLoginRedirect: 'none',
  },

  onLoad() {
    this._initAccess();
  },

  onShow() {
    this._coachOnShow();
    if (AdminWxBiz.isSuperSession()) {
      this._loadOverview();
    }
  },

  onPullDownRefresh() {
    this._loadOverview().finally(() => wx.stopPullDownRefresh());
  },

  async _initAccess() {
    if (!AdminWxBiz.isSuperSession()) {
      const ok = await AdminWxBiz.ensureSession();
      if (!ok) {
        this.setData({
          adminLoginShow: true,
          adminLoginMode: 'coach',
          adminLoginRedirect: 'none',
        });
        return;
      }
    }
    if (!AdminWxBiz.isSuperSession()) {
      wx.showToast({ title: '仅超级管理员可访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    await this._loadOverview();
  },

  async _loadOverview() {
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/platform_overview',
        {},
        { title: 'bar' },
      );
      this.setData({
        loading: false,
        tenantList: (res && res.tenantList) || [],
        stats: {
          tenantCount: (res && res.tenantCount) || 0,
          adminCount: (res && res.adminCount) || 0,
        },
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, tenantList: [] });
    }
  },

  bindAddTenantTap() {
    wx.navigateTo({ url: '/pages/admin/platform/tenant_form/admin_tenant_form' });
  },

  bindAddAdminTap(e) {
    const pid = e.currentTarget.dataset.pid;
    if (pid) {
      pageHelper.setTenant({ _pid: pid, TENANT_NAME: e.currentTarget.dataset.name || '' });
    }
    wx.navigateTo({ url: '/pages/admin/platform/mgr_form/admin_mgr_form' });
  },

  bindEnterCoachTap(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item._pid) return;
    pageHelper.setTenant(item);
    wx.reLaunch({ url: '/pages/coach/index/coach_index' });
  },

  bindAdminLoginCloseTap() {
    this.setData({ adminLoginShow: false });
    if (!AdminBiz.getAdminToken()) wx.navigateBack();
  },

  bindAdminLoginSuccessTap() {
    this.setData({ adminLoginShow: false });
    this._initAccess();
  },
});
