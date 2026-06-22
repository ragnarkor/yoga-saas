const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

const CARD_DEFS = [
  { label: '全部会员卡', key: 'total', icon: 'friends-o', color: '#64b5f6' },
  { label: '新增会员卡', key: 'newCard', icon: 'add-o', color: '#81c784' },
  { label: '本月生日', key: 'monthBirthday', icon: 'gift-o', color: '#f48fb1' },
  { label: '本月新增会员', key: 'monthNew', icon: 'contact', color: '#4fc3f7' },
  { label: '30天未上课', key: 'inactive30', icon: 'close', color: '#ffb74d' },
  { label: '流失会员', key: 'churn', icon: 'warning-o', color: '#e57373' },
  { label: '次数不足', key: 'lowTimes', icon: 'info-o', color: '#b39ddb' },
  { label: '储蓄不足', key: 'lowBalance', icon: 'gold-coin-o', color: '#ffb74d' },
  { label: '即将到期', key: 'expiringSoon', icon: 'clock-o', color: '#ce93d8' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    cards: CARD_DEFS.map((c) => ({ ...c, num: 0 })),
    loading: false,
  },

  onShow() {
    this._coachOnShow();
    this._loadStats();
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._loadStats();
  },

  async _loadStats() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    this.setData({ loading: true });
    try {
      const stats = await cloudHelper.callCloudData(
        'admin/member_stats',
        {},
        { hint: false, title: 'bar' },
      );
      const cards = CARD_DEFS.map((c) => ({
        ...c,
        num: stats && stats[c.key] != null ? stats[c.key] : 0,
      }));
      this.setData({ cards, loading: false });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  async onCardTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!(await this._coachBeforeAdmin('/pages/coach/member/coach_member_list'))) return;
    if (key === 'newCard') {
      wx.navigateTo({ url: '/pages/coach/card/coach_card_list' });
      return;
    }
    wx.navigateTo({ url: '/pages/coach/member/coach_member_list' });
  },
});
