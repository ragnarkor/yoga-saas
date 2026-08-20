const cloudHelper = require('../../../../helper/cloud_helper.js');

Page({
  data: { loading: true, cards: [], guide: '', contact: '', themeColor: '#5b8a72', wechatPay: false },

  onLoad() { this.load(); },

  async load() {
    try {
      const r = await cloudHelper.callCloudData('my/card_shop', {}, { hint: false });
      this.setData({
        loading: false,
        cards: r.cards || [],
        guide: r.guide || '',
        contact: r.contact || '',
        wechatPay: !!r.wechatPay,
      });
    } catch (e) {
      this.setData({ loading: false });
      console.error(e);
    }
  },

  async buy(e) {
    const id = e.currentTarget.dataset.id;
    // 未开通微信支付：直接走线下申请
    if (!this.data.wechatPay) return this._createOrder(id, 'offline');

    // 已开通：让会员选择付款方式
    const res = await new Promise((resolve) =>
      wx.showActionSheet({
        itemList: ['微信支付', '线下付款（馆主确认）'],
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      }),
    );
    if (res === 0) return this._createOrder(id, 'wechat');
    if (res === 1) return this._createOrder(id, 'offline');
  },

  async _createOrder(id, payType) {
    try {
      const r = await cloudHelper.callCloudSumbit(
        'my/card_order_create',
        { tplId: id, payType },
        { title: '提交中' },
      );

      if (payType === 'wechat' && r && r.payment) {
        return this._pay(r.payment);
      }

      wx.showModal({
        title: '申请已提交',
        content: '请按馆方付款说明完成付款，馆主确认到账后会自动为你发卡。',
        showCancel: false,
        success: () => wx.navigateTo({ url: '/pages/default/my/card_order/card_order' }),
      });
    } catch (err) {
      console.error(err);
    }
  },

  _pay(payment) {
    wx.requestPayment(
      Object.assign({}, payment, {
        success: () => {
          wx.showModal({
            title: '支付成功',
            content: '会员卡将自动发放到你的账户，可在「我的卡包」查看。',
            showCancel: false,
            success: () => wx.navigateTo({ url: '/pages/default/my/card_order/card_order' }),
          });
        },
        fail: (err) => {
          if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) return; // 用户取消
          wx.showToast({ title: '支付未完成', icon: 'none' });
        },
      }),
    );
  },
});
