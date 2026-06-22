const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminBiz = require('../../../biz/admin_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    tenantName: '',
    stats: { todayJoin: 0, newCard: 0, newMember: 0 },
    noticeText: '',
    noticeTime: '',
    quickTools: [
      { name: '超管入口', icon: 'desktop-o', color: '#9b6fd4', url: '/pages/admin/index/login/admin_login' },
      { name: '邀请会员', icon: 'star-o', color: '#9b6fd4', url: '' },
      { name: '签到码', icon: 'qr', color: '#9b6fd4', url: '/pages/admin/meet/scan/admin_meet_scan' },
    ],
    menus: [
      { name: '预约', icon: 'clock-o', color: '#f48fb1', url: '/pages/admin/meet/list/admin_meet_list' },
      { name: '排课', icon: 'calendar-o', color: '#64b5f6', url: '/pages/admin/meet/time/admin_meet_time' },
      { name: '课程管理', icon: 'apps-o', color: '#81c784', url: '/pages/admin/meet/list/admin_meet_list' },
      { name: '私教', icon: 'exchange', color: '#b39ddb', url: '/pages/admin/meet/list/admin_meet_list' },
      { name: '会员', icon: 'friends-o', color: '#64b5f6', url: '/pages/admin/user/list/admin_user_list' },
      { name: '绑定码', icon: 'contact', color: '#f48fb1', url: '/pages/admin/mgr/bind/admin_mgr_bind' },
      { name: '会员卡', icon: 'coupon-o', color: '#ffb74d', url: '' },
      { name: '教室', icon: 'shop-o', color: '#f48fb1', url: '' },
      { name: '数据统计', icon: 'bar-chart-o', color: '#64b5f6', url: '/pages/admin/index/home/admin_home' },
    ],
  },

  onLoad() {
    this._loadCoachData();
  },

  onShow() {
    this._coachOnShow();
  },

  async _loadCoachData() {
    await this._loadStats();
  },

  async _loadStats() {
    if (!AdminBiz.getAdminToken()) return;
    try {
      const res = await cloudHelper.callCloudData('admin/home', {}, { hint: false });
      if (res) {
        this.setData({
          stats: {
            todayJoin: res.todayJoinCnt || 0,
            newCard: res.newCardCnt || 0,
            newMember: res.newUserCnt || 0,
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  async onMenuTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: '功能开发中', icon: 'none' });
      return;
    }
    if (!(await this._coachBeforeAdmin(url))) return;
    wx.navigateTo({ url });
  },

  onPullDownRefresh() {
    this._loadStats().finally(() => wx.stopPullDownRefresh());
  },
});
