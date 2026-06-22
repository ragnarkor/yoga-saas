const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '资金明细',
    loading: true,
    totalAmount: 0,
    monthAmount: 0,
    list: [],
    page: 1,
    hasMore: true,
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadData(true);
  },

  onPullDownRefresh() {
    this._loadData(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this._loadData(false);
    }
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._loadData(true);
  },

  async _loadData(refresh) {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    const page = refresh ? 1 : this.data.page + 1;
    this.setData({ loading: true, ...(refresh ? { list: [], hasMore: true } : {}) });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/stats_fund',
        { page, size: 20 },
        { hint: false, title: refresh ? 'bar' : 'bar' },
      );
      const items = (res && res.list) || [];
      this.setData({
        totalAmount: (res && res.totalAmount) || 0,
        monthAmount: (res && res.monthAmount) || 0,
        list: refresh ? items : this.data.list.concat(items),
        page,
        hasMore: items.length >= 20,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
