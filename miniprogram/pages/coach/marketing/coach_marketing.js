Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    todayAmount: 0,
    todayCount: 0,
    malls: [
      { name: '商城', sub: '（会员卡）', icon: 'shopping-cart-o', color: '#f48fb1' },
      { name: '商城', sub: '（实物）', icon: 'shop-o', color: '#64b5f6' },
      { name: '敬请期待', sub: '', icon: 'question-o', color: '#b39ddb' },
    ],
  },

  onShow() {
    this._coachOnShow();
  },

  onMallTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
});
