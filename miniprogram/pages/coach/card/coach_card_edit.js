const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

const COLOR_OPTIONS = ['#F5A623', '#4A90A4', '#E57373', '#81C784', '#9B6FD4'];
const TYPE_LABELS = { times: '次数卡', period: '期限卡' };

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    pageTitle: '新增会员卡',
    loading: false,
    cardId: '',
    colorOptions: COLOR_OPTIONS,
    form: {
      name: '',
      type: 'times',
      typeLabel: '次数卡',
      days: '365',
      price: '0',
      quota: '1',
      color: COLOR_OPTIONS[0],
    },
  },

  onLoad(options) {
    this._applyCoachTheme();
    const id = options.id || '';
    const mode = options.mode || '';
    this.setData({
      cardId: id,
      pageTitle: id ? (mode === 'manage' ? '卡管理' : '编辑会员卡') : '新增会员卡',
    });
    if (id) this._loadDetail(id);
  },

  async _loadDetail(id) {
    this.setData({ loading: true });
    try {
      const item = await cloudHelper.callCloudData(
        'admin/card_tpl_detail',
        { id },
        { hint: false, title: 'bar' },
      );
      if (item) {
        this.setData({
          loading: false,
          form: {
            name: item.CARD_TPL_NAME || '',
            type: item.CARD_TPL_TYPE || 'times',
            typeLabel: TYPE_LABELS[item.CARD_TPL_TYPE] || '次数卡',
            days: String(item.CARD_TPL_DAYS || 365),
            price: String(item.CARD_TPL_PRICE || 0),
            quota: String(item.CARD_TPL_QUOTA || 1),
            color: item.CARD_TPL_COLOR || COLOR_OPTIONS[0],
          },
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  bindFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail;
    if (!field) return;
    this.setData({ [`form.${field}`]: val });
  },

  bindTypeTap() {
    wx.showActionSheet({
      itemList: ['次数卡', '期限卡'],
      success: (res) => {
        const type = res.tapIndex === 1 ? 'period' : 'times';
        this.setData({
          'form.type': type,
          'form.typeLabel': TYPE_LABELS[type],
        });
      },
    });
  },

  bindColorTap(e) {
    const color = e.currentTarget.dataset.color;
    if (color) this.setData({ 'form.color': color });
  },

  async bindSaveTap() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    const form = this.data.form;
    if (!(form.name || '').trim()) {
      wx.showToast({ title: '请填写卡名称', icon: 'none' });
      return;
    }

    try {
      await cloudHelper.callCloudSumbit(
        'admin/card_tpl_save',
        {
          id: this.data.cardId || undefined,
          name: form.name.trim(),
          type: form.type,
          days: Number(form.days) || 365,
          price: Number(form.price) || 0,
          quota: Number(form.quota) || 1,
          color: form.color,
        },
        { title: '保存中' },
      );
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      console.error(e);
    }
  },
});
