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
  },

  onLoad() {
    this._applyCoachTheme();
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
      const memberList = await Promise.all(
        list.map(async (item) => {
          let avatarSrc = '';
          if (item.USER_PIC) {
            avatarSrc = await UserProfileBiz.resolveAvatarUrl(item.USER_PIC);
          }
          return { ...item, avatarSrc };
        }),
      );
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
});
