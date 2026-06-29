const cloudHelper = require('../../../helper/cloud_helper.js');
const timeHelper = require('../../../helper/time_helper.js');
const pageHelper = require('../../../helper/page_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '上课统计',
    loading: true,
    startDay: timeHelper.time('Y-M') + '-01',
    endDay: timeHelper.time('Y-M-D'),
    dateRangeText: '',
    coachId: '',
    coachName: '全部教练',
    coachOptions: [],
    categorySummary: [],
    coaches: [],
    filterShow: false,
    filterStartDay: '',
    filterEndDay: '',
    filterCoachId: '',
    endYear: new Date().getFullYear() + 1,
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

  bindFilterOpenTap() {
    this.setData({
      filterShow: true,
      filterStartDay: this.data.startDay,
      filterEndDay: this.data.endDay,
      filterCoachId: this.data.coachId || '',
    });
  },

  bindFilterCloseTap() {
    this.setData({ filterShow: false });
  },

  bindFilterCoachTap(e) {
    const coachId = e.currentTarget.dataset.id || '';
    this.setData({ filterCoachId: coachId });
  },

  bindFilterResetTap() {
    const today = timeHelper.time('Y-M-D');
    this.setData({
      filterStartDay: timeHelper.time('Y-M') + '-01',
      filterEndDay: today,
      filterCoachId: '',
    });
  },

  bindFilterConfirmTap() {
    const { filterStartDay, filterEndDay, filterCoachId } = this.data;
    if (!filterStartDay || !filterEndDay) {
      pageHelper.showNoneToast('请选择日期范围');
      return;
    }
    if (filterStartDay > filterEndDay) {
      pageHelper.showNoneToast('起始日期不能晚于终止日期');
      return;
    }
    this.setData({
      filterShow: false,
      startDay: filterStartDay,
      endDay: filterEndDay,
      coachId: filterCoachId,
    });
    this._loadData();
  },

  url(e) {
    pageHelper.url(e, this);
  },

  bindCourseTap(e) {
    const { meetId, title } = e.currentTarget.dataset;
    const params = [
      'sortType=checkin',
      'dayStart=' + encodeURIComponent(this.data.startDay),
      'dayEnd=' + encodeURIComponent(this.data.endDay),
    ];
    if (title) params.push('search=' + encodeURIComponent(title));
    wx.navigateTo({
      url: '/pages/coach/stats/coach_stats_join?' + params.join('&'),
    });
  },

  async _loadData() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const params = {
        startDay: this.data.startDay,
        endDay: this.data.endDay,
      };
      if (this.data.coachId) params.coachId = this.data.coachId;
      const res = await cloudHelper.callCloudData(
        'admin/stats_class',
        params,
        { hint: false, title: 'bar' },
      );
      const coachOptions = (res && res.coachOptions) || [];
      let coachName = '全部教练';
      if (res && res.coachId) {
        const hit = coachOptions.find((c) => c.coachId === res.coachId);
        coachName = hit ? hit.coachName : '已选教练';
      }
      this.setData({
        dateRangeText: (res && res.dateRangeText) || '',
        coachId: (res && res.coachId) || '',
        coachName,
        coachOptions,
        categorySummary: (res && res.categorySummary) || [],
        coaches: ((res && res.coaches) || []).map((item) => ({
          ...item,
          coachInitial: (item.coachName || '教').slice(0, 1),
        })),
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
