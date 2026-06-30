const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const UserProfileBiz = require('../../../biz/user_profile_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '会员',
    emptyText: '暂无会员',
    keyword: '',
    memberList: [],
    total: 0,
    loading: true,
    attentionType: '',
  },

  onLoad(options) {
    this._applyCoachTheme();
    const attentionType = (options.type || '').trim();
    this.setData({ attentionType });
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
    if (!this.data.attentionType) {
      this.setData({ loading: false, memberList: [] });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/attention_members',
        {
          type: this.data.attentionType,
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
      const total = (res && res.total) || memberList.length;
      const title = (res && res.title) || '会员';
      this.setData({
        memberList,
        total,
        emptyText: (res && res.emptyText) || '暂无会员',
        loading: false,
        navTitle: total ? `${title}（${total}人）` : title,
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
