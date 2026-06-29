const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const UserProfileBiz = require('../../../biz/user_profile_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '本月新增会员卡',
    keyword: '',
    memberList: [],
    monthText: '',
    totalMembers: 0,
    totalCards: 0,
    loading: true,
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadMembers();
  },

  onPullDownRefresh() {
    this._loadMembers().finally(() => wx.stopPullDownRefresh());
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._loadMembers();
  },

  async _loadMembers() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/month_new_card_members',
        {
          search: this.data.keyword || '',
          page: 1,
          size: 200,
        },
        { hint: false, title: 'bar' },
      );
      const list = (res && res.list) || [];
      const picUrls = list.map((item) => item.USER_PIC).filter(Boolean);
      const avatarMap = await UserProfileBiz.resolveAvatarUrlMap(picUrls);
      const memberList = list.map((item) => ({
        ...item,
        avatarSrc: item.USER_PIC ? avatarMap[item.USER_PIC] || '' : '',
      }));
      const totalMembers = (res && res.totalMembers) || memberList.length;
      const totalCards = (res && res.totalCards) || 0;
      const monthText = (res && res.monthText) || '';
      this.setData({
        memberList,
        totalMembers,
        totalCards,
        monthText,
        loading: false,
        navTitle: totalMembers
          ? `本月新增会员卡（${totalMembers}人）`
          : '本月新增会员卡',
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, memberList: [] });
    }
  },

  bindSearchInput(e) {
    this.setData({ keyword: e.detail.value || '' });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this._loadMembers(), 400);
  },

  bindSearchConfirm() {
    this._loadMembers();
  },

  bindIssueTap(e) {
    const userId = e.currentTarget.dataset.id;
    const userName = e.currentTarget.dataset.name || '';
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/coach/card/coach_card_issue?userId=${userId}&userName=${encodeURIComponent(userName)}`,
    });
  },

  bindCardsTap(e) {
    const userId = e.currentTarget.dataset.id;
    const userName = e.currentTarget.dataset.name || '';
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/coach/card/coach_user_card_list?userId=${userId}&userName=${encodeURIComponent(userName)}`,
    });
  },
});
