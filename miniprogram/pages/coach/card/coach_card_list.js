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
        cardList: ((res && res.list) || []).map((item) => this._formatCardItem(item)),
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

  _formatCardItem(item) {
    const metaTags = [];
    if (item.CARD_TPL_DAYS) {
      metaTags.push({ key: 'days', label: '有效期', value: `${item.CARD_TPL_DAYS}天` });
    }
    if (item.CARD_TPL_TYPE === 'times' && item.CARD_TPL_QUOTA) {
      metaTags.push({ key: 'quota', label: '额度', value: `${item.CARD_TPL_QUOTA}次` });
    }
    if (item.CARD_TPL_PRICE != null && item.CARD_TPL_PRICE !== '') {
      metaTags.push({
        key: 'price',
        label: '售价',
        value: `¥${item.CARD_TPL_PRICE}`,
        highlight: true,
      });
    }
    const scopeDesc = item.scopeDesc || '全馆课程';
    if (scopeDesc && scopeDesc !== '全馆课程') {
      metaTags.push({ key: 'scope', label: '适用', value: scopeDesc });
    }
    return { ...item, metaTags };
  },

  bindCardTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/coach/card/coach_card_edit?id=${id}` });
  },
});
