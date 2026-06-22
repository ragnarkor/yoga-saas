const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    cards: [
      { label: '全部会员卡', num: 0, icon: 'friends-o' },
      { label: '新增会员卡', num: 0, icon: 'add-o' },
      { label: '本月生日', num: 0, icon: 'gift-o' },
      { label: '本月新增会员', num: 0, icon: 'contact' },
      { label: '30天未上课', num: 0, icon: 'close' },
      { label: '流失会员', num: 0, icon: 'warning-o' },
      { label: '次数不足', num: 0, icon: 'info-o' },
      { label: '储蓄不足', num: 0, icon: 'gold-coin-o' },
      { label: '即将到期', num: 0, icon: 'clock-o' },
    ],
  },

  onShow() {
    this._coachOnShow();
  },

  async onCardTap() {
    if (!(await this._coachBeforeAdmin('/pages/admin/user/list/admin_user_list'))) return;
    wx.navigateTo({ url: '/pages/admin/user/list/admin_user_list' });
  },
});
