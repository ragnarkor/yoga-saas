const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    userId: '',
    userName: '',
    navTitle: '持卡管理',
    loading: true,
    cardList: [],
  },

  onLoad(options) {
    this._applyCoachTheme();
    const userId = options.userId || '';
    const userName = decodeURIComponent(options.userName || '');
    this.setData({
      userId,
      userName,
      navTitle: userName ? `${userName} · 持卡` : '持卡管理',
    });
    this._loadCards();
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
    if (!this.data.userId) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/user_card_list',
        { userId: this.data.userId },
        { hint: false, title: 'bar' },
      );
      this.setData({
        cardList: (res && res.list) || [],
        loading: false,
        userName: (res && res.userName) || this.data.userName,
        navTitle: (res && res.userName)
          ? `${res.userName} · 持卡`
          : this.data.navTitle,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, cardList: [] });
    }
  },

  bindCardTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/coach/card/coach_user_card_manage?cardId=${id}&userName=${encodeURIComponent(this.data.userName)}`,
    });
  },

  bindIssueTap() {
    const { userId, userName } = this.data;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/coach/card/coach_card_issue?userId=${userId}&userName=${encodeURIComponent(userName)}`,
    });
  },

  bindDeleteTap(e) {
    const cardId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该会员卡';
    if (!cardId) return;
    wx.vibrateShort({ type: 'light' });
    wx.showModal({
      title: '删除会员卡？',
      content: `确定删除「${name}」？删除后不可恢复，变动记录仍保留。`,
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return;
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) return;
        try {
          await cloudHelper.callCloudSumbit(
            'admin/user_card_del',
            { cardId },
            { title: '删除中' },
          );
          wx.showToast({ title: '已删除', icon: 'success' });
          this._loadCards();
        } catch (err) {
          console.error(err);
        }
      },
    });
  },
});
