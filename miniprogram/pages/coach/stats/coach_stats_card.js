const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '会员卡分析',
    loading: true,
    summary: [],
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
        'admin/stats_card_analysis',
        {},
        { hint: false, title: 'bar' },
      );
      this.setData({
        summary: (res && res.summary) || [],
        detail: (res && res.detail) || [],
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
