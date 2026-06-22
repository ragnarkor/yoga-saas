const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const timeHelper = require('../../../helper/time_helper.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '排课查询',
    loading: true,
    list: [],
    startDay: '',
    endDay: '',
  },

  onLoad() {
    this._applyCoachTheme();
    const startDay = timeHelper.time('Y-M-D');
    const endDay = timeHelper.time('Y-M-D', 86400 * 6);
    this.setData({ startDay, endDay });
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
        'admin/stats_schedule_query',
        {
          startDay: this.data.startDay,
          endDay: this.data.endDay,
        },
        { hint: false, title: 'bar' },
      );
      this.setData({
        list: (res && res.list) || [],
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
