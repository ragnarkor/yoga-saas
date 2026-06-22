const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    cardList: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadCards();
  },

  onShow() {
    this._coachOnShow();
    if (!this.data.loading) this._loadCards();
  },

  onPullDownRefresh() {
    this._loadCards().finally(() => wx.stopPullDownRefresh());
  },

  async _loadCards() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/card_tpl_list',
        {},
        { hint: false, title: 'bar' },
      );
      this.setData({
        cardList: (res && res.list) || [],
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, cardList: [] });
    }
  },

  bindAddTap() {
    wx.navigateTo({ url: '/pages/coach/card/coach_card_edit' });
  },

  bindEditTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/coach/card/coach_card_edit?id=${id}` });
  },

  bindManageTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/coach/card/coach_card_edit?id=${id}&mode=manage` });
  },
});
