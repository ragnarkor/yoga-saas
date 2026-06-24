const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const UserProfileBiz = require('../../../biz/user_profile_biz.js');

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'has', label: '有卡' },
  { key: 'none', label: '无卡' },
  { key: 'stop', label: '停卡' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '会员',
    keyword: '',
    filters: FILTERS,
    activeFilter: 'all',
    memberList: [],
    total: 0,
    loading: true,
    pickMode: false,
  },

  onLoad(options) {
    this._applyCoachTheme();
    this.setData({
      pickMode: options.pick === '1',
      navTitle: options.pick === '1' ? '选择会员' : '会员',
    });
    this._loadMembers();
  },

  onPullDownRefresh() {
    this._loadMembers().finally(() => wx.stopPullDownRefresh());
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
        'admin/coach_member_list',
        {
          search: this.data.keyword || '',
          cardFilter: this.data.activeFilter,
          page: 1,
          size: 100,
        },
        { hint: false, title: 'bar' },
      );
      const list = (res && res.list) || [];
      const total = (res && res.total) || list.length;
      const picUrls = list.map((item) => item.USER_PIC).filter(Boolean);
      const avatarMap = await UserProfileBiz.resolveAvatarUrlMap(picUrls);
      const memberList = list.map((item) => ({
        ...item,
        avatarSrc: item.USER_PIC ? avatarMap[item.USER_PIC] || '' : '',
      }));
      this.setData({
        memberList,
        total,
        loading: false,
        navTitle: total ? `会员（${total}人）` : '会员',
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

  bindFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeFilter) return;
    this.setData({ activeFilter: key }, () => this._loadMembers());
  },

  bindAddTap() {
    wx.showToast({ title: '请使用「邀请会员」添加新会员', icon: 'none' });
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

  bindMemberRowTap(e) {
    if (!this.data.pickMode) return;
    const userId = e.currentTarget.dataset.id;
    const userName = e.currentTarget.dataset.name || '';
    if (!userId) return;
    const pages = getCurrentPages();
    const prev = pages.length > 1 ? pages[pages.length - 2] : null;
    if (prev && typeof prev.setData === 'function') {
      const patch = {
        userId,
        userName,
        bookUserId: userId,
        bookUserName: userName,
        bookCardId: '',
      };
      if (prev.data && prev.data.form) {
        patch['form.cardId'] = '';
        patch['form.cardName'] = '';
      }
      prev.setData(patch);
    }
    wx.navigateBack();
  },
});
