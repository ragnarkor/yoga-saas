const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminBiz = require('../../../biz/admin_biz.js');
const themeHelper = require('../../../helper/theme_helper.js');
const setting = require('../../../setting/setting.js');

function findThemePickIndex(color, presetColors) {
  const normalized = themeHelper.normalizeHex(color);
  const index = (presetColors || []).findIndex(
    (item) => themeHelper.normalizeHex(item.color) === normalized,
  );
  return index >= 0 ? index : 0;
}

function fmtPicList(list) {
  return (list || [])
    .filter(Boolean)
    .map((item) => pageHelper.fmtImgUrl(item));
}

function toFileList(list) {
  return fmtPicList(list).map((url) => ({ url, isImage: true }));
}

function hasMapPoint(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return !Number.isNaN(latitude) && !Number.isNaN(longitude) && latitude !== 0 && longitude !== 0;
}

function buildMapMarkers(lat, lng, name) {
  if (!hasMapPoint(lat, lng)) return [];
  return [
    {
      id: 1,
      latitude: Number(lat),
      longitude: Number(lng),
      title: name || '门店',
      width: 28,
      height: 28,
    },
  ];
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    activeTab: 0,
    tabs: [
      { id: 'basic', name: '基础' },
      { id: 'contact', name: '联系' },
      { id: 'course', name: '课程' },
      { id: 'brand', name: '品牌' },
    ],
    tenantName: '',
    tenantDesc: '',
    tenantAbout: '',
    contactPhone: '',
    contactAddress: '',
    contactLatitude: '',
    contactLongitude: '',
    hasMapPoint: false,
    mapMarkers: [],
    logoList: [],
    logoFileList: [],
    aboutPics: [],
    aboutFileList: [],
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

  _syncMapState(extra = {}) {
    const lat = extra.contactLatitude !== undefined ? extra.contactLatitude : this.data.contactLatitude;
    const lng = extra.contactLongitude !== undefined ? extra.contactLongitude : this.data.contactLongitude;
    const name = extra.tenantName !== undefined ? extra.tenantName : this.data.tenantName;
    this.setData({
      hasMapPoint: hasMapPoint(lat, lng),
      mapMarkers: buildMapMarkers(lat, lng, name),
    });
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
      const contact = (res && res.contact) || {};
      if (tenant._pid) {
        pageHelper.setTenant(tenant);
      }
      const themeColor = pageHelper.getThemeColor();
      const patch = {
        loading: false,
        tenantName: tenant.TENANT_NAME || '',
        tenantDesc: tenant.TENANT_DESC || '',
        tenantAbout: (res && res.about) || '',
        contactPhone: contact.phone || '',
        contactAddress: contact.address || '',
        contactLatitude: contact.latitude || '',
        contactLongitude: contact.longitude || '',
        logoList: tenant.TENANT_LOGO ? fmtPicList([tenant.TENANT_LOGO]) : [],
        logoFileList: tenant.TENANT_LOGO ? toFileList([tenant.TENANT_LOGO]) : [],
        aboutPics: fmtPicList((res && res.aboutPics) || []),
        aboutFileList: toFileList((res && res.aboutPics) || []),
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
      this._syncMapState({
        contactLatitude: patch.contactLatitude,
        contactLongitude: patch.contactLongitude,
        tenantName: patch.tenantName,
      });
      if (!this.data.themeDirty) {
        this._applyCoachTheme(themeColor);
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  bindFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [field]: e.detail || '' });
  },

  bindCategoryFieldChange(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `categories[${idx}].name`;
    this.setData({ [key]: e.detail || '' });
  },

  bindCategoryNameInput(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `categories[${idx}].name`;
    this.setData({ [key]: e.detail.value || '' });
  },

  onStoreTabTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({ activeTab: index });
  },

  bindChooseLocationTap() {
    if (!this.data.canEdit) return;
    wx.chooseLocation({
      success: (res) => {
        const address = res.address || res.name || '';
        this.setData({
          contactAddress: address,
          contactLatitude: res.latitude,
          contactLongitude: res.longitude,
        });
        this._syncMapState({
          contactLatitude: res.latitude,
          contactLongitude: res.longitude,
        });
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) return;
        wx.showToast({ title: '请授权位置后选点', icon: 'none' });
      },
    });
  },

  bindClearLocationTap() {
    if (!this.data.canEdit) return;
    this.setData({
      contactLatitude: '',
      contactLongitude: '',
    });
    this._syncMapState({ contactLatitude: '', contactLongitude: '' });
  },

  bindPreviewMapTap() {
    if (!hasMapPoint(this.data.contactLatitude, this.data.contactLongitude)) {
      wx.showToast({ title: '请先选择地图位置', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: Number(this.data.contactLatitude),
      longitude: Number(this.data.contactLongitude),
      name: this.data.tenantName || '门店',
      address: this.data.contactAddress || '',
      scale: 16,
    });
  },

  bindLogoAfterRead(e) {
    const file = e.detail.file;
    const files = Array.isArray(file) ? file : [file];
    const logoFileList = files.slice(0, 1).map((f) => ({ url: f.url, isImage: true }));
    this.setData({
      logoFileList,
      logoList: logoFileList.map((f) => f.url),
    });
  },

  bindLogoDelete() {
    this.setData({ logoFileList: [], logoList: [] });
  },

  bindAboutAfterRead(e) {
    const file = e.detail.file;
    const files = Array.isArray(file) ? file : [file];
    const newItems = files.map((f) => ({ url: f.url, isImage: true }));
    const aboutFileList = this.data.aboutFileList.concat(newItems).slice(0, 8);
    this.setData({
      aboutFileList,
      aboutPics: aboutFileList.map((f) => f.url),
    });
  },

  bindAboutDelete(e) {
    const index = e.detail.index;
    const aboutFileList = this.data.aboutFileList.slice();
    aboutFileList.splice(index, 1);
    this.setData({
      aboutFileList,
      aboutPics: aboutFileList.map((f) => f.url),
    });
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
    this.setData({ themePickIndex: index, themeDirty: true, themeColor: color });
    this._applyCoachTheme(color);
  },

  async bindSaveTap() {
    const tenantName = (this.data.tenantName || '').trim();
    if (!tenantName) {
      wx.showToast({ title: '请填写门店名称', icon: 'none' });
      return;
    }

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
      wx.showLoading({ title: '保存中', mask: true });

      let logoList = this.data.logoList.slice();
      if (logoList.length) {
        logoList = await cloudHelper.transTempPics(
          logoList,
          setting.SETUP_PIC_PATH,
          'logo',
        );
      }

      let aboutPics = this.data.aboutPics.slice();
      if (aboutPics.length) {
        aboutPics = await cloudHelper.transTempPics(
          aboutPics,
          setting.SETUP_PIC_PATH,
          'about',
        );
      }

      const res = await cloudHelper.callCloudSumbit(
        'admin/tenant_store_save',
        {
          tenantName,
          tenantDesc: this.data.tenantDesc,
          about: this.data.tenantAbout,
          tenantLogo: logoList.length ? logoList[0] : '',
          aboutPic: aboutPics,
          categories,
          themeColor: this.data.themeColor,
          contactPhone: this.data.contactPhone,
          contactAddress: this.data.contactAddress,
          contactLatitude: this.data.contactLatitude,
          contactLongitude: this.data.contactLongitude,
        },
        { title: '保存中' },
      );
      wx.hideLoading();

      const data = (res && res.data) || {};
      const contact = data.contact || {};
      const tenant = pageHelper.getTenantInfo() || {};
      pageHelper.setTenant({
        ...tenant,
        TENANT_NAME: data.TENANT_NAME || tenantName,
        TENANT_DESC: data.TENANT_DESC || this.data.tenantDesc,
        TENANT_LOGO: data.TENANT_LOGO || (logoList[0] || ''),
        TENANT_MEET_TYPE: data.TENANT_MEET_TYPE,
        TENANT_THEME_COLOR: this.data.themeColor,
      });

      const themeColor = pageHelper.getThemeColor();
      this.setData({
        tenantName: data.TENANT_NAME || tenantName,
        tenantDesc: data.TENANT_DESC || this.data.tenantDesc,
        tenantAbout:
          data.about !== undefined ? data.about : this.data.tenantAbout,
        contactPhone: contact.phone || this.data.contactPhone,
        contactAddress: contact.address || this.data.contactAddress,
        contactLatitude: contact.latitude || this.data.contactLatitude,
        contactLongitude: contact.longitude || this.data.contactLongitude,
        logoList: fmtPicList(
          data.TENANT_LOGO
            ? [data.TENANT_LOGO]
            : logoList.length
              ? logoList
              : [],
        ),
        logoFileList: toFileList(
          data.TENANT_LOGO
            ? [data.TENANT_LOGO]
            : logoList.length
              ? logoList
              : [],
        ),
        aboutPics: fmtPicList(
          data.aboutPics !== undefined ? data.aboutPics : aboutPics,
        ),
        aboutFileList: toFileList(
          data.aboutPics !== undefined ? data.aboutPics : aboutPics,
        ),
        categories: data.categories || categories,
        themeColor,
        themePickIndex: findThemePickIndex(
          themeColor,
          this.data.presetColors,
        ),
        themeDirty: false,
      });
      this._syncMapState({
        tenantName: data.TENANT_NAME || tenantName,
        contactLatitude: contact.latitude || this.data.contactLatitude,
        contactLongitude: contact.longitude || this.data.contactLongitude,
      });
      this._applyCoachTheme(themeColor);
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      console.error(e);
    }
  },
});
