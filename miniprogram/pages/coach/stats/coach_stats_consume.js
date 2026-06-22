const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '耗卡统计',
    loading: true,
    totalConsumed: 0,
    totalInit: 0,
    consumeRate: 0,
    usedCardCnt: 0,
    detail: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadData();
  },

  onPullDownRefresh() {
    this._loadData().finally(() => wx.stopPullDownRefresh());
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._loadData();
  },

  async _loadData() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/stats_consume',
        {},
        { hint: false, title: 'bar' },
      );
      this.setData({
        totalConsumed: (res && res.totalConsumed) || 0,
        totalInit: (res && res.totalInit) || 0,
        consumeRate: (res && res.consumeRate) || 0,
        usedCardCnt: (res && res.usedCardCnt) || 0,
        detail: (res && res.detail) || [],
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
