const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminBiz = require('../../../biz/admin_biz.js');
const cardActivateHelper = require('../../../helper/card_activate_helper.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    userId: '',
    userName: '',
    pageLoading: true,
    tplList: [],
    tplSheetShow: false,
    activateSheetShow: false,
    selectedTplId: '',
    selectedTpl: null,
    activateOptions: cardActivateHelper.ACTIVATE_OPTIONS,
    form: {
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
    this.setData({ userId, userName, selectedTplId: tplId });
    const admin = AdminBiz.getAdminToken();
    if (admin && admin.name) {
      this.setData({
        'form.coachId': admin.id || admin.adminId || '',
        'form.coachName': admin.name,
      });
    }
    this._initPage();
  },

  async _initPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ pageLoading: false });
      return;
    }
    await this._loadTplList();
    if (this.data.selectedTplId) {
      this._syncSelectedTpl(this.data.selectedTplId);
    }
    this.setData({ pageLoading: false });
  },

  async _loadTplList() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/card_tpl_list',
        {},
        { hint: false },
      );
      const tplList = ((res && res.list) || []).map((item) => this._formatTplItem(item));
      this.setData({ tplList });
    } catch (e) {
      console.error(e);
      this.setData({ tplList: [] });
    }
  },

  _formatTplItem(item) {
    const metaTags = [];
    if (item.CARD_TPL_DAYS) {
      metaTags.push({ key: 'days', label: '有效期', value: `${item.CARD_TPL_DAYS}天` });
    }
    if (item.CARD_TPL_TYPE === 'times' && item.CARD_TPL_QUOTA) {
      metaTags.push({ key: 'quota', label: '额度', value: `${item.CARD_TPL_QUOTA}次` });
    }
    if (item.CARD_TPL_PRICE != null && item.CARD_TPL_PRICE !== '') {
      metaTags.push({ key: 'price', label: '售价', value: `¥${item.CARD_TPL_PRICE}` });
    }
    const scopeDesc = item.scopeDesc || '全馆课程';
    return { ...item, metaTags, scopeDesc };
  },

  _syncSelectedTpl(tplId) {
    const selectedTpl = this.data.tplList.find((item) => item.CARD_TPL_ID === tplId) || null;
    this.setData({ selectedTplId: tplId, selectedTpl });
  },

  bindFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail;
    if (!field) return;
    this.setData({ [`form.${field}`]: val });
  },

  bindTplFieldTap() {
    if (!this.data.tplList.length) {
      wx.showToast({ title: '暂无会员卡模板', icon: 'none' });
      return;
    }
    this.setData({ tplSheetShow: true });
  },

  bindCloseTplSheet() {
    this.setData({ tplSheetShow: false });
  },

  bindTplPick(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this._syncSelectedTpl(id);
    this.setData({ tplSheetShow: false });
  },

  bindActivateFieldTap() {
    this.setData({ activateSheetShow: true });
  },

  bindCloseActivateSheet() {
    this.setData({ activateSheetShow: false });
  },

  bindActivatePick(e) {
    const value = e.currentTarget.dataset.value;
    const label = e.currentTarget.dataset.label || '';
    if (!value) return;
    this.setData({
      'form.activate': value,
      'form.activateLabel': label,
      activateSheetShow: false,
    });
  },

  bindCoachTap() {
    wx.showToast({ title: '默认当前登录教练', icon: 'none' });
  },

  async bindSubmitTap() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    const { userId, selectedTplId, selectedTpl, form } = this.data;
    if (!userId) {
      wx.showToast({ title: '缺少会员信息', icon: 'none' });
      return;
    }
    if (!selectedTplId || !selectedTpl) {
      wx.showToast({ title: '请选择会员卡', icon: 'none' });
      return;
    }

    try {
      await cloudHelper.callCloudSumbit(
        'admin/user_card_issue',
        {
          userId,
          tplId: selectedTplId,
          name: selectedTpl.CARD_TPL_NAME,
          type: selectedTpl.CARD_TPL_TYPE,
          days: Number(selectedTpl.CARD_TPL_DAYS) || 365,
          price: Number(selectedTpl.CARD_TPL_PRICE) || 0,
          quota: Number(selectedTpl.CARD_TPL_QUOTA) || 1,
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
