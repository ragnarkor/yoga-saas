const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminBiz = require('../../../biz/admin_biz.js');

const TYPE_LABELS = { times: '次数卡', period: '期限卡' };

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    userId: '',
    userName: '',
    tplId: '',
    form: {
      name: '',
      type: 'times',
      typeLabel: '次数卡',
      days: '365',
      price: '38',
      quota: '1',
      activate: 'immediate',
      activateLabel: '立即激活',
      coachId: '',
      coachName: '',
      memo: '',
    },
  },

  onLoad(options) {
    this._applyCoachTheme();
    const userId = options.userId || '';
    const userName = decodeURIComponent(options.userName || '');
    const tplId = options.tplId || '';
    this.setData({ userId, userName, tplId });
    if (tplId) {
      this._loadTpl(tplId);
    } else {
      this.setData({ 'form.name': '一次卡' });
    }
    const admin = AdminBiz.getAdminToken();
    if (admin && admin.name) {
      this.setData({
        'form.coachId': admin.id || admin.adminId || '',
        'form.coachName': admin.name,
      });
    }
  },

  async _loadTpl(tplId) {
    try {
      const item = await cloudHelper.callCloudData(
        'admin/card_tpl_detail',
        { id: tplId },
        { hint: false },
      );
      if (!item) return;
      this.setData({
        form: {
          ...this.data.form,
          name: item.CARD_TPL_NAME || '',
          type: item.CARD_TPL_TYPE || 'times',
          typeLabel: TYPE_LABELS[item.CARD_TPL_TYPE] || '次数卡',
          days: String(item.CARD_TPL_DAYS || 365),
          price: String(item.CARD_TPL_PRICE || 0),
          quota: String(item.CARD_TPL_QUOTA || 1),
        },
      });
    } catch (e) {
      console.error(e);
    }
  },

  bindFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail;
    if (!field) return;
    this.setData({ [`form.${field}`]: val });
  },

  bindActivateTap() {
    wx.showActionSheet({
      itemList: ['立即激活', '首次上课激活'],
      success: (res) => {
        const map = ['immediate', 'first_class'];
        const labels = ['立即激活', '首次上课激活'];
        this.setData({
          'form.activate': map[res.tapIndex] || 'immediate',
          'form.activateLabel': labels[res.tapIndex] || '立即激活',
        });
      },
    });
  },

  bindCoachTap() {
    wx.showToast({ title: '默认当前登录教练', icon: 'none' });
  },

  async bindSubmitTap() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    const { userId, tplId, form } = this.data;
    if (!userId) {
      wx.showToast({ title: '缺少会员信息', icon: 'none' });
      return;
    }
    if (!(form.name || '').trim()) {
      wx.showToast({ title: '请填写卡名称', icon: 'none' });
      return;
    }

    try {
      await cloudHelper.callCloudSumbit(
        'admin/user_card_issue',
        {
          userId,
          tplId: tplId || undefined,
          name: form.name.trim(),
          type: form.type,
          days: Number(form.days) || 365,
          price: Number(form.price) || 0,
          quota: Number(form.quota) || 1,
          activate: form.activate,
          coachId: form.coachId,
          coachName: form.coachName,
          memo: form.memo,
        },
        { title: '发卡中' },
      );
      wx.showToast({ title: '发卡成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      console.error(e);
    }
  },
});
