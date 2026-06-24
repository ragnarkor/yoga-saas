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

function splitCategoryViews(categories) {
  const groupRows = [];
  const privateRows = [];
  (categories || []).forEach((c, idx) => {
    const row = { ...c, _idx: idx };
    if (c.isPrivate === true) privateRows.push(row);
    else groupRows.push(row);
  });
  return { groupRows, privateRows };
}

function reorderCategories(categories) {
  const group = (categories || []).filter((c) => c.isPrivate !== true);
  const priv = (categories || []).filter((c) => c.isPrivate === true);
  return group.concat(priv);
}

const CATE_ROW_RPX = 88;

function getCateRowHeightPx() {
  const { windowWidth } = wx.getSystemInfoSync();
  return (windowWidth / 750) * CATE_ROW_RPX;
}

function withDragMeta(rows, rowH) {
  return (rows || []).map((r, i) => ({
    ...r,
    dragY: i * rowH,
    dragEnabled: false,
  }));
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
    groupRows: [],
    privateRows: [],
    groupAreaHeight: 0,
    privateAreaHeight: 0,
    cateRowHeight: 0,
    canEdit: false,
    themeColor: themeHelper.DEFAULT_THEME,
    themePickIndex: 0,
    themeDirty: false,
    presetColors: themeHelper.PRESET_THEME_COLORS,
    privateOpenTime: '07:00',
    privateCloseTime: '22:00',
    privateAdvanceHours: '2',
    privateMaxBookDays: '14',
  },

  onLoad() {
    this._rowHeightPx = getCateRowHeightPx();
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

  _applyCategories(categories) {
    const ordered = reorderCategories(categories);
    const views = splitCategoryViews(ordered);
    const rowH = this._rowHeightPx || getCateRowHeightPx();
    this._rowHeightPx = rowH;
    const groupRows = withDragMeta(views.groupRows, rowH);
    const privateRows = withDragMeta(views.privateRows, rowH);
    this.setData({
      categories: ordered,
      groupRows,
      privateRows,
      groupAreaHeight: groupRows.length * rowH,
      privateAreaHeight: privateRows.length * rowH,
      cateRowHeight: rowH,
    });
  },

  _syncSectionOrder(section, rows, dragId) {
    const isPrivate = section === 'private';
    const group = this.data.categories.filter((c) => c.isPrivate !== true);
    const priv = this.data.categories.filter((c) => c.isPrivate === true);
    const sorted = rows
      .map((r) => {
        const hit = this.data.categories.find((c) => c.id === r.id);
        return hit ? { ...hit, name: r.name } : null;
      })
      .filter(Boolean);
    const categories = isPrivate ? group.concat(sorted) : sorted.concat(priv);
    const rowH = this._rowHeightPx;
    const views = splitCategoryViews(categories);
    const markDrag = (list) =>
      withDragMeta(list, rowH).map((r) => ({
        ...r,
        dragEnabled: dragId ? r.id === dragId : false,
      }));
    this.setData({
      categories,
      groupRows: markDrag(views.groupRows),
      privateRows: markDrag(views.privateRows),
      groupAreaHeight: views.groupRows.length * rowH,
      privateAreaHeight: views.privateRows.length * rowH,
    });
  },

  bindCategoryDragChange(e) {
    if (!this.data.canEdit) return;
    if (e.detail.source !== 'touch' && e.detail.source !== 'touch-out-of-bounds') return;
    const section = e.currentTarget.dataset.section;
    const listIndex = Number(e.currentTarget.dataset.listIndex);
    if (Number.isNaN(listIndex)) return;

    const rowH = this._rowHeightPx;
    const y = e.detail.y;
    let targetIndex = Math.round(y / rowH);
    const rowsKey = section === 'private' ? 'privateRows' : 'groupRows';
    const rows = this.data[rowsKey];
    targetIndex = Math.max(0, Math.min(rows.length - 1, targetIndex));
    if (targetIndex === listIndex) return;

    const newRows = rows.slice();
    const [item] = newRows.splice(listIndex, 1);
    newRows.splice(targetIndex, 0, item);
    newRows.forEach((r, i) => {
      r.dragY = i * rowH;
    });
    this._syncSectionOrder(section, newRows, item.id);
  },

  bindCateDragEnable(e) {
    if (!this.data.canEdit) return;
    const section = e.currentTarget.dataset.section;
    const listIndex = Number(e.currentTarget.dataset.listIndex);
    if (Number.isNaN(listIndex)) return;
    const rowsKey = section === 'private' ? 'privateRows' : 'groupRows';
    const rows = this.data[rowsKey].map((r, i) => ({
      ...r,
      dragEnabled: i === listIndex,
    }));
    wx.vibrateShort({ type: 'light' });
    this.setData({ [rowsKey]: rows });
  },

  bindCategoryDragEnd(e) {
    const section = e.currentTarget.dataset.section;
    const rowsKey = section === 'private' ? 'privateRows' : 'groupRows';
    const rowH = this._rowHeightPx;
    const rows = this.data[rowsKey].map((r, i) => ({
      ...r,
      dragY: i * rowH,
      dragEnabled: false,
    }));
    this.setData({ [rowsKey]: rows });
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
        canEdit,
      };
      const ps = (res && res.privateSchedule) || {};
      patch.privateOpenTime = ps.openTime || '07:00';
      patch.privateCloseTime = ps.closeTime || '22:00';
      patch.privateAdvanceHours = String(ps.advanceHours != null ? ps.advanceHours : 2);
      patch.privateMaxBookDays = String(ps.maxBookDays != null ? ps.maxBookDays : 14);
      if (!this.data.themeDirty) {
        patch.themeColor = themeColor;
        patch.themePickIndex = findThemePickIndex(
          themeColor,
          this.data.presetColors,
        );
      }
      this.setData(patch);
      this._applyCategories((res && res.categories) || []);
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
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const name = e.detail.value || '';
    const categories = this.data.categories.slice();
    if (!categories[idx]) return;
    categories[idx] = { ...categories[idx], name };
    const groupRows = this.data.groupRows.map((r) =>
      r._idx === idx ? { ...r, name } : r,
    );
    const privateRows = this.data.privateRows.map((r) =>
      r._idx === idx ? { ...r, name } : r,
    );
    this.setData({ categories, groupRows, privateRows });
  },

  bindMoveToPrivate(e) {
    if (!this.data.canEdit) return;
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const categories = this.data.categories.slice();
    const item = categories[idx];
    if (!item || item.isPrivate === true) return;
    categories[idx] = { ...item, isPrivate: true };
    this._applyCategories(categories);
  },

  bindMoveToGroup(e) {
    if (!this.data.canEdit) return;
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const categories = this.data.categories.slice();
    const item = categories[idx];
    if (!item || item.isPrivate !== true) return;
    categories[idx] = { ...item, isPrivate: false };
    this._applyCategories(categories);
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

  bindAddGroupCategory() {
    const categories = this.data.categories.slice();
    categories.push({ id: String(categories.length + 1), name: '', isPrivate: false });
    this._applyCategories(categories);
  },

  bindAddPrivateCategory() {
    const categories = this.data.categories.slice();
    categories.push({ id: String(categories.length + 1), name: '', isPrivate: true });
    this._applyCategories(categories);
  },

  bindRemoveCategory(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const categories = this.data.categories.slice();
    if (categories.length <= 1) {
      wx.showToast({ title: '至少保留一个分类', icon: 'none' });
      return;
    }
    const removing = categories[idx];
    const groupCount = categories.filter((c) => c.isPrivate !== true).length;
    if (removing && removing.isPrivate !== true && groupCount <= 1) {
      wx.showToast({ title: '至少保留一个团课分类', icon: 'none' });
      return;
    }
    categories.splice(idx, 1);
    this._applyCategories(categories);
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

    const ordered = reorderCategories(this.data.categories);
    const categories = ordered
      .map((c, i) => ({
        id: String(i + 1),
        name: (c.name || '').trim(),
        isPrivate: c.isPrivate === true,
      }))
      .filter((c) => c.name);

    if (!categories.length) {
      wx.showToast({ title: '请填写分类名称', icon: 'none' });
      return;
    }
    if (!categories.some((c) => c.isPrivate !== true)) {
      wx.showToast({ title: '请至少保留一个团课分类', icon: 'none' });
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
          privateSchedule: {
            openTime: (this.data.privateOpenTime || '07:00').trim(),
            closeTime: (this.data.privateCloseTime || '22:00').trim(),
            advanceHours: Number(this.data.privateAdvanceHours) || 0,
            maxBookDays: Number(this.data.privateMaxBookDays) || 14,
          },
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
        themeColor,
        themePickIndex: findThemePickIndex(
          themeColor,
          this.data.presetColors,
        ),
        themeDirty: false,
      });
      this._applyCategories(data.categories || categories);
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
