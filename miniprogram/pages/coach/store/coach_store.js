const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminBiz = require('../../../biz/admin_biz.js');
const themeHelper = require('../../../helper/theme_helper.js');

function findThemePickIndex(color, presetColors) {
  const normalized = themeHelper.normalizeHex(color);
  const index = (presetColors || []).findIndex(
    (item) => themeHelper.normalizeHex(item.color) === normalized,
  );
  return index >= 0 ? index : 0;
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    tenantName: '',
    tenantDesc: '',
    categories: [],
    canEdit: false,
    themeColor: themeHelper.DEFAULT_THEME,
    themePickIndex: 0,
    themeDirty: false,
    presetColors: themeHelper.PRESET_THEME_COLORS,
  },

  onLoad() {
    this._loadStore();
  },

  onShow() {
    this._coachOnShow();
  },

  async _loadCoachData() {
    this.setData({ themeDirty: false });
    await this._loadStore();
  },

  async _loadStore() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }

    const admin = AdminBiz.getAdminToken();
    const canEdit =
      admin && (admin.type === 'owner' || admin.type === 'super');

    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_store',
        {},
        { title: 'bar' },
      );
      const tenant = (res && res.tenant) || {};
      if (tenant._pid) {
        pageHelper.setTenant(tenant);
      }
      const themeColor = pageHelper.getThemeColor();
      const patch = {
        loading: false,
        tenantName: tenant.TENANT_NAME || '',
        tenantDesc: tenant.TENANT_DESC || '',
        categories: (res && res.categories) || [],
        canEdit,
      };
      if (!this.data.themeDirty) {
        patch.themeColor = themeColor;
        patch.themePickIndex = findThemePickIndex(
          themeColor,
          this.data.presetColors,
        );
      }
      this.setData(patch);
      if (!this.data.themeDirty) {
        this._applyCoachTheme(themeColor);
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  bindDescInput(e) {
    this.setData({ tenantDesc: e.detail.value || '' });
  },

  bindNameInput(e) {
    const idx = e.currentTarget.dataset.index;
    const val = e.detail.value;
    const key = `categories[${idx}].name`;
    this.setData({ [key]: val });
  },

  bindAddCategory() {
    const categories = this.data.categories.slice();
    const nextId = String(categories.length + 1);
    categories.push({ id: nextId, name: '' });
    this.setData({ categories });
  },

  bindRemoveCategory(e) {
    const idx = e.currentTarget.dataset.index;
    const categories = this.data.categories.slice();
    if (categories.length <= 1) {
      wx.showToast({ title: '至少保留一个分类', icon: 'none' });
      return;
    }
    categories.splice(idx, 1);
    categories.forEach((c, i) => {
      c.id = String(i + 1);
    });
    this.setData({ categories });
  },

  bindThemePick(e) {
    if (!this.data.canEdit) {
      wx.showToast({ title: '仅馆主可修改主题色', icon: 'none' });
      return;
    }
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.presetColors[index];
    if (!item) return;

    const color = themeHelper.normalizeHex(item.color);
    this.setData({ themePickIndex: index, themeDirty: true });
    this._applyCoachTheme(color);
  },

  async bindSaveTap() {
    const categories = this.data.categories
      .map((c, i) => ({
        id: String(i + 1),
        name: (c.name || '').trim(),
      }))
      .filter((c) => c.name);

    if (!categories.length) {
      wx.showToast({ title: '请填写分类名称', icon: 'none' });
      return;
    }

    try {
      const res = await cloudHelper.callCloudSumbit(
        'admin/tenant_store_save',
        {
          categories,
          themeColor: this.data.themeColor,
          tenantDesc: this.data.tenantDesc,
        },
        { title: '保存中' },
      );
      const data = (res && res.data) || {};
      const tenant = pageHelper.getTenantInfo() || {};
      pageHelper.setTenant({
        ...tenant,
        TENANT_MEET_TYPE: data.TENANT_MEET_TYPE,
        TENANT_THEME_COLOR: this.data.themeColor,
      });
      const themeColor = pageHelper.getThemeColor();
      this.setData({
        categories: data.categories || categories,
        themeColor,
        themePickIndex: findThemePickIndex(
          themeColor,
          this.data.presetColors,
        ),
        themeDirty: false,
      });
      this._applyCoachTheme(themeColor);
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      console.error(e);
    }
  },
});
