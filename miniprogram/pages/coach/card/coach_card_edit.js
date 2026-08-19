const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const cardScopeHelper = require('../../../helper/card_scope_helper.js');
const cardFaceHelper = require('../../../helper/card_face_helper.js');

const DEFAULT_COLOR = cardFaceHelper.COLOR_PRESETS[0].value;
const STYLE_OPTIONS = cardFaceHelper.getStylePickerOptions();
const TYPE_LABELS = { times: '次数卡', period: '期限卡' };

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    pageTitle: '新增会员卡',
    loading: false,
    cardId: '',
    styleOptions: STYLE_OPTIONS,
    styleSheetShow: false,
    selectedStyleKey: cardFaceHelper.getStyleKey('', DEFAULT_COLOR),
    selectedStyleLabel: cardFaceHelper.getStyleLabel('', DEFAULT_COLOR),
    coverPreviewUrl: '',
    scopeMode: 'all',
    scopeCategoryIds: [],
    scopeMeetIds: [],
    form: {
      name: '',
      type: 'times',
      typeLabel: '次数卡',
      days: '365',
      price: '0',
      quota: '1',
      color: DEFAULT_COLOR,
      coverId: '',
    },
  },

  onLoad(options) {
    this._applyCoachTheme();
    const id = options.id || '';
    this.setData({
      cardId: id,
      pageTitle: id ? '编辑会员卡' : '新增会员卡',
    });
    if (id) this._loadDetail(id);
    else this._syncStyleState();
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
          scopeMeetIds: scope.meetIds,
          form: {
            name: item.CARD_TPL_NAME || '',
            type: item.CARD_TPL_TYPE || 'times',
            typeLabel: TYPE_LABELS[item.CARD_TPL_TYPE] || '次数卡',
            days: String(item.CARD_TPL_DAYS || 365),
            price: String(item.CARD_TPL_PRICE || 0),
            quota: String(item.CARD_TPL_QUOTA || 1),
            color: item.CARD_TPL_COLOR || DEFAULT_COLOR,
            coverId: item.coverId || item.CARD_TPL_COVER || '',
          },
        });
        this._syncStyleState();
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  onScopeChange(e) {
    const { mode, categoryIds, meetIds } = e.detail;
    this.setData({
      scopeMode: mode,
      scopeCategoryIds: categoryIds || [],
      scopeMeetIds: meetIds || [],
    });
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

  _syncStyleState() {
    const { coverId, color } = this.data.form;
    this.setData({
      selectedStyleKey: cardFaceHelper.getStyleKey(coverId, color),
      selectedStyleLabel: cardFaceHelper.getStyleLabel(coverId, color),
      coverPreviewUrl: cardFaceHelper.getCoverUrl(coverId),
    });
  },

  bindStyleFieldTap() {
    this.setData({ styleSheetShow: true });
  },

  bindCloseStyleSheet() {
    this.setData({ styleSheetShow: false });
  },

  bindStyleTap(e) {
    const pickerKey = e.currentTarget.dataset.key || '';
    const pick = cardFaceHelper.parseStylePick(pickerKey);
    const patch = { 'form.coverId': pick.coverId };
    if (pick.color) patch['form.color'] = pick.color;
    this.setData(patch);
    this._syncStyleState();
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
    if (this.data.scopeMode === 'meets' && !this.data.scopeMeetIds.length) {
      wx.showToast({ title: '请选择适用课程', icon: 'none' });
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
          cover: form.coverId || '',
          scope: {
            mode: this.data.scopeMode,
            categoryIds: this.data.scopeCategoryIds,
            meetIds: this.data.scopeMeetIds,
          },
        },
        { title: '保存中' },
      );
      const pages = getCurrentPages();
      const previous = pages[pages.length - 2];
      if (previous && typeof previous._loadCards === 'function') {
        await previous._loadCards();
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      console.error(e);
    }
  },
});
