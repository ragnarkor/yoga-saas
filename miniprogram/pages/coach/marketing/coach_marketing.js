Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    todayAmount: 0,
    todayCount: 0,
    malls: [
      { name: '商城', sub: '（会员卡）', icon: 'shopping-cart-o' },
      { name: '商城', sub: '（实物）', icon: 'shop-o' },
      { name: '敬请期待', sub: '', icon: 'question-o' },
    ],
  },

  onShow() {
    this._coachOnShow();
  },

  onMallTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
});
