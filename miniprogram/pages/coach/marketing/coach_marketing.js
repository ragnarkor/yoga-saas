Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    purchaseEnabled: false,
    activeCount: 0,
    guide: '',
  },

  onShow() {
    this._coachOnShow();
    this._loadCoachData();
  },

  async _loadCoachData() {
    const ok = await require('../../../biz/admin_wx_biz.js').ensureSession();
    if (!ok) return this.setData({ loading: false });
    try {
      const res = await require('../../../helper/cloud_helper.js').callCloudData(
        'admin/card_marketing_get', {}, { hint: false },
      );
      this.setData({
        loading: false,
        purchaseEnabled: !!(res && res.enabled),
        activeCount: (res && res.activeCount) || 0,
        guide: (res && res.guide) || '',
      });
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
    }
  },

  bindCardSaleTap() {
    wx.navigateTo({ url: '/pages/coach/marketing/coach_card_sale' });
  },

  bindCardOrderTap() {
    wx.navigateTo({ url: '/pages/coach/marketing/coach_card_order' });
  },
});
