const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const bookingWeekHelper = require('../../../helper/booking_week_helper.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    weekOffset: 0,
    weekLabel: '',
    startDay: '',
    endDay: '',
    sessionList: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._initWeek(0);
  },

  onShow() {
    this._coachOnShow();
    this._loadList();
  },

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },

  _initWeek(offset) {
    const range = bookingWeekHelper.getWeekRange(offset);
    this.setData({
      weekOffset: offset,
      weekLabel: range.weekLabel,
      startDay: range.startDay,
      endDay: range.endDay,
    });
  },

  async _loadList() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/private_list',
        { startDay: this.data.startDay, endDay: this.data.endDay },
        { hint: false, title: 'bar' },
      );
      this.setData({
        loading: false,
        sessionList: (res && res.list) || [],
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, sessionList: [] });
    }
  },

  bindPrevWeek() {
    this._initWeek(this.data.weekOffset - 1);
    this._loadList();
  },

  bindNextWeek() {
    this._initWeek(this.data.weekOffset + 1);
    this._loadList();
  },

  bindBookTap() {
    wx.navigateTo({ url: '/pages/coach/private/coach_private_book' });
  },

  bindSessionTap(e) {
    const ds = e.currentTarget.dataset;
    if (!ds.meetId || !ds.mark) return;
    const qs = [
      'meetId=' + ds.meetId,
      'mark=' + encodeURIComponent(ds.mark),
      'day=' + ds.day,
      'title=' + encodeURIComponent(ds.title || ''),
      'start=' + encodeURIComponent(ds.start || ''),
      'end=' + encodeURIComponent(ds.end || ''),
      'teacherName=' + encodeURIComponent(ds.teacherName || ''),
      'typeName=' + encodeURIComponent(ds.typeName || '私教'),
      'duration=60',
      'limit=1',
      'booked=' + (ds.booked || 0),
      'difficulty=3',
      'slotStatus=1',
    ].join('&');
    wx.navigateTo({ url: '/pages/coach/booking/coach_booking_detail?' + qs });
  },
});
