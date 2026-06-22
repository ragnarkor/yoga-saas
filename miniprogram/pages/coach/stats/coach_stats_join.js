const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'succ', label: '已预约' },
  { key: 'checkin', label: '已签到' },
  { key: 'cancel', label: '已取消' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '预约查询',
    loading: true,
    filters: FILTERS,
    activeFilter: '',
    keyword: '',
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

  bindSearchInput(e) {
    this.setData({ keyword: e.detail.value || '' });
  },

  bindSearchConfirm() {
    this._loadData(true);
  },

  bindFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeFilter) return;
    this.setData({ activeFilter: key });
    this._loadData(true);
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
      const params = {
        page,
        size: 20,
        search: this.data.keyword || '',
      };
      if (this.data.activeFilter) params.sortType = this.data.activeFilter;
      const res = await cloudHelper.callCloudData(
        'admin/stats_join_query',
        params,
        { hint: false, title: refresh ? 'bar' : 'bar' },
      );
      const items = (res && res.list) || [];
      this.setData({
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
