const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    saving: false,
    enabled: false,
    guide: '',
    contact: '',
    cards: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadMarketing();
  },

  onShow() {
    this._coachOnShow();
  },

  onPullDownRefresh() {
    this._loadMarketing().finally(() => wx.stopPullDownRefresh());
  },

  async _loadMarketing() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return this.setData({ loading: false });
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData('admin/card_marketing_get', {}, { hint: false });
      this.setData({
        loading: false,
        enabled: !!(res && res.enabled),
        guide: (res && res.guide) || '',
        contact: (res && res.contact) || '',
        cards: ((res && res.cards) || []).map((card) => ({
          ...card,
          salePriceYuan: card.salePriceFee ? (card.salePriceFee / 100).toFixed(2).replace(/\.00$/, '') : '',
        })),
      });
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
    }
  },

  bindEnabledChange(e) {
    this.setData({ enabled: !!e.detail });
  },

  bindTextInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [field]: e.detail });
  },

  bindCardSwitch(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({ [`cards[${index}].saleEnabled`]: !!e.detail });
  },

  bindCardInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    if (Number.isNaN(index) || !field) return;
    this.setData({ [`cards[${index}].${field}`]: e.detail });
  },

  async bindSaveTap() {
    if (this.data.saving) return;
    const activeCards = this.data.cards.filter((card) => card.saleEnabled);
    if (this.data.enabled && !activeCards.length) {
      return wx.showToast({ title: '请至少选择一种可购买套餐', icon: 'none' });
    }
    if (this.data.enabled && !String(this.data.guide || '').trim()) {
      return wx.showToast({ title: '请填写付款说明', icon: 'none' });
    }
    this.setData({ saving: true });
    try {
      await cloudHelper.callCloudSumbit('admin/card_marketing_save', {
        enabled: this.data.enabled,
        guide: this.data.guide,
        contact: this.data.contact,
        cards: this.data.cards.map((card) => ({
          id: card.id,
          saleEnabled: !!card.saleEnabled,
          salePriceFee: card.salePriceYuan === '' ? 0 : Math.round(Number(card.salePriceYuan || 0) * 100),
          saleDesc: card.saleDesc || '',
        })),
      }, { title: '保存中' });
      wx.showToast({ title: '已保存', icon: 'success' });
      await this._loadMarketing();
    } catch (err) {
      console.error(err);
    } finally {
      this.setData({ saving: false });
    }
  },
});
