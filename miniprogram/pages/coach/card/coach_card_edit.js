const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const cardScopeHelper = require('../../../helper/card_scope_helper.js');

const COLOR_OPTIONS = [
  { value: '#F5A623', label: '暖橙色' },
  { value: '#4A90A4', label: '青蓝色' },
  { value: '#E57373', label: '珊瑚红' },
  { value: '#81C784', label: '薄荷绿' },
  { value: '#9B6FD4', label: '薰衣草' },
];
const TYPE_LABELS = { times: '次数卡', period: '期限卡' };

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    pageTitle: '新增会员卡',
    loading: false,
    cardId: '',
    categories: [],
    scopeCategories: [],
    colorOptions: COLOR_OPTIONS,
    colorSheetShow: false,
    scopeSheetShow: false,
    selectedColorLabel: COLOR_OPTIONS[0].label,
    scopeMode: 'all',
    scopeCategoryIds: [],
    scopeDescText: '全馆课程',
    form: {
      name: '',
      type: 'times',
      typeLabel: '次数卡',
      days: '365',
      price: '0',
      quota: '1',
      color: COLOR_OPTIONS[0].value,
    },
  },

  onLoad(options) {
    this._applyCoachTheme();
    const id = options.id || '';
    this.setData({
      cardId: id,
      pageTitle: id ? '编辑会员卡' : '新增会员卡',
    });
    this._loadCategories();
    if (id) this._loadDetail(id);
  },

  async _loadCategories() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_store',
        {},
        { hint: false },
      );
      this.setData({ categories: (res && res.categories) || [] });
      this._syncScopeCategories();
      this._syncScopeDesc();
    } catch (e) {
      console.error(e);
    }
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
        const scope = cardScopeHelper.normalizeScope(item.scope || item.CARD_TPL_SCOPE);
        this.setData({
          loading: false,
          scopeMode: scope.mode,
          scopeCategoryIds: scope.categoryIds,
          form: {
            name: item.CARD_TPL_NAME || '',
            type: item.CARD_TPL_TYPE || 'times',
            typeLabel: TYPE_LABELS[item.CARD_TPL_TYPE] || '次数卡',
            days: String(item.CARD_TPL_DAYS || 365),
            price: String(item.CARD_TPL_PRICE || 0),
            quota: String(item.CARD_TPL_QUOTA || 1),
            color: item.CARD_TPL_COLOR || COLOR_OPTIONS[0].value,
          },
        });
        this._syncColorLabel();
        this._syncScopeCategories();
        this._syncScopeDesc();
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  _syncScopeDesc() {
    const scope = {
      mode: this.data.scopeMode,
      categoryIds: this.data.scopeCategoryIds,
    };
    this.setData({
      scopeDescText: cardScopeHelper.buildScopeDesc(scope, this.data.categories),
    });
  },

  _syncScopeCategories() {
    const ids = this.data.scopeCategoryIds || [];
    const scopeCategories = (this.data.categories || []).map((c) => ({
      ...c,
      selected: ids.includes(String(c.id)),
    }));
    this.setData({ scopeCategories });
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

  _syncColorLabel() {
    const color = (this.data.form.color || '').toLowerCase();
    const hit = this.data.colorOptions.find(
      (c) => c.value.toLowerCase() === color,
    );
    this.setData({ selectedColorLabel: hit ? hit.label : '自定义' });
  },

  bindColorTap(e) {
    const color = e.currentTarget.dataset.color;
    const label = e.currentTarget.dataset.label || '';
    if (!color) return;
    this.setData({
      'form.color': color,
      selectedColorLabel: label,
      colorSheetShow: false,
    });
  },

  bindColorFieldTap() {
    this.setData({ colorSheetShow: true });
  },

  bindCloseColorSheet() {
    this.setData({ colorSheetShow: false });
  },

  bindScopeFieldTap() {
    this.setData({ scopeSheetShow: true });
  },

  bindCloseScopeSheet() {
    this.setData({ scopeSheetShow: false });
  },

  bindScopeAllTap() {
    this.setData({ scopeMode: 'all', scopeCategoryIds: [] }, () => {
      this._syncScopeCategories();
      this._syncScopeDesc();
    });
  },

  bindScopeCategoryTap(e) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) return;
    let ids = this.data.scopeCategoryIds.slice();
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(id);
    this.setData({
      scopeMode: 'categories',
      scopeCategoryIds: ids,
    }, () => {
      this._syncScopeCategories();
      this._syncScopeDesc();
    });
  },

  bindScopeDoneTap() {
    if (this.data.scopeMode === 'categories' && !this.data.scopeCategoryIds.length) {
      wx.showToast({ title: '请选择分类或选全馆', icon: 'none' });
      return;
    }
    this.setData({ scopeSheetShow: false });
  },

  async bindSaveTap() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    const form = this.data.form;
    if (!(form.name || '').trim()) {
      wx.showToast({ title: '请填写卡名称', icon: 'none' });
      return;
    }
    if (this.data.scopeMode === 'categories' && !this.data.scopeCategoryIds.length) {
      wx.showToast({ title: '请选择适用课程分类', icon: 'none' });
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
          scope: {
            mode: this.data.scopeMode,
            categoryIds: this.data.scopeCategoryIds,
          },
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
