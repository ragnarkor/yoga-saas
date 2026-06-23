const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminBiz = require('../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    tenantName: '',
    adminLoginShow: false,
    adminLoginMode: 'coach',
    adminLoginRedirect: 'none',
    stats: { todayJoin: 0, newCard: 0, newMember: 0 },
    noticeText: '',
    noticeTime: '',
    inviteShow: false,
    inviteShare: null,
    isSuperAdmin: false,
    quickTools: [
      { name: '邀请会员', icon: 'star-o', color: '#ffb74d', action: 'invite' },
      { name: '签到码', icon: 'qr', color: '#81c784', url: '/pages/admin/meet/scan/admin_meet_scan' },
    ],
    menus: [
      { name: '预约', icon: 'clock-o', color: '#f48fb1', url: '/pages/coach/booking/coach_booking' },
      { name: '排课', icon: 'calendar-o', color: '#64b5f6', url: '/pages/coach/schedule/coach_schedule' },
      { name: '课程管理', icon: 'apps-o', color: '#81c784', url: '/pages/coach/course/coach_course_list' },
      { name: '私教', icon: 'exchange', color: '#b39ddb', url: '/pages/admin/meet/list/admin_meet_list' },
      { name: '会员', icon: 'friends-o', color: '#4fc3f7', url: '/pages/coach/member/coach_member_list' },
      { name: '员工管理', icon: 'friends-o', color: '#9575cd', action: 'staff' },
      { name: '会员卡', icon: 'coupon-o', color: '#ffb74d', url: '/pages/coach/card/coach_card_list' },
      { name: '教室', icon: 'shop-o', color: '#ce93d8', url: '' },
      { name: '数据统计', icon: 'bar-chart-o', color: '#64b5f6', url: '/pages/coach/stats/coach_stats_index' },
    ],
  },

  onShow() {
    this._syncSuperAdmin();
    if (AdminBiz.getAdminToken()) {
      this._loadStats();
    }
  },

  onLoad() {
    this._applyCoachTheme();
    this._initCoachAccess();
  },

  _syncSuperAdmin() {
    this.setData({ isSuperAdmin: AdminWxBiz.isSuperSession() });
  },

  async _initCoachAccess() {
    if (AdminWxBiz.isSuperSession()) {
      await AdminWxBiz.prepareCoachEntry();
      this._syncSuperAdmin();
      this._loadCoachData();
      return;
    }
    const ok = await AdminWxBiz.ensureSession();
    if (!ok && !AdminWxBiz.isSuperSession()) {
      this.setData({
        adminLoginShow: true,
        adminLoginMode: 'coach',
        adminLoginRedirect: 'none',
      });
      return;
    }
    this._loadCoachData();
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._loadCoachData();
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
    const action = e.currentTarget.dataset.action;
    const url = e.currentTarget.dataset.url;

    if (action === 'invite') {
      this.setData({ inviteShow: true });
      return;
    }

    if (action === 'platform') {
      this.onPlatformTap();
      return;
    }

    if (action === 'staff') {
      this.onStaffTap();
      return;
    }

    if (!url) {
      wx.showToast({ title: '功能开发中', icon: 'none' });
      return;
    }
    if (!(await this._coachBeforeAdmin(url))) return;
    wx.navigateTo({ url });
  },

  onPlatformTap() {
    if (!AdminWxBiz.isSuperSession()) {
      this.setData({
        adminLoginShow: true,
        adminLoginMode: 'coach',
        adminLoginRedirect: 'none',
      });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/index/home/admin_home' });
  },

  onStaffTap() {
    if (!AdminBiz.getAdminToken()) {
      wx.showToast({ title: '请先登录教练版', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/coach/staff/coach_staff' });
  },

  bindAdminLoginCloseTap() {
    this.setData({ adminLoginShow: false });
  },

  async bindAdminLoginSuccessTap() {
    await AdminWxBiz.prepareCoachEntry();
    await this._coachOnShow();
    this._syncSuperAdmin();
    this._loadCoachData();
  },

  bindInviteCloseTap() {
    this.setData({ inviteShow: false, inviteShare: null });
  },

  bindInviteReadyTap(e) {
    this.setData({ inviteShare: e.detail || null });
  },

  onShareAppMessage() {
    const share = this.data.inviteShare;
    if (this.data.inviteShow && share) {
      return {
        title: `邀请您加入「${share.tenantName || '瑜伽馆'}」`,
        path: share.sharePath || '/pages/public/member_invite/member_invite',
        imageUrl: share.qrUrl || '',
      };
    }
    return {
      title: '教练版工作台',
      path: '/pages/coach/index/coach_index',
    };
  },

  onPullDownRefresh() {
    this._loadStats().finally(() => wx.stopPullDownRefresh());
  },
});
