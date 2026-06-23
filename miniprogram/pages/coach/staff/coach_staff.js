const AdminBiz = require('../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const pageHelper = require('../../../helper/page_helper.js');

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'bound', label: '已绑定' },
  { key: 'pending', label: '待绑定' },
  { key: 'coach', label: '教练' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '员工',
    keyword: '',
    filters: FILTERS,
    activeFilter: 'all',
    rawList: [],
    displayList: [],
    loading: true,
    selfOnly: false,
    canManage: false,
    addShow: false,
    addForm: { name: '', phone: '' },
    submitting: false,
  },

  onLoad() {
    this._initPage();
  },

  onShow() {
    this._coachOnShow();
    if (AdminBiz.getAdminToken() && pageHelper.getPID()) {
      this._loadList();
    }
  },

  async _initPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok || !AdminBiz.getAdminToken()) {
      wx.showToast({ title: '请先登录教练版', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    if (!pageHelper.getPID()) {
      wx.showModal({
        title: '提示',
        content: '请先在顶部选择要管理的门店',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }
    this._syncRoleFlags();
    this._loadList();
  },

  _syncRoleFlags() {
    const admin = AdminBiz.getAdminToken();
    const isSuperAdmin = AdminWxBiz.isSuperSession();
    const canManage =
      isSuperAdmin || (admin && admin.type === 'owner');
    this.setData({ canManage });
  },

  _hasManageActions(item) {
    return !!(item.canGenCode || item.canUnbind || item.canDelete);
  },

  _decorateItem(item) {
    const name = item.name || '';
    const initial = name.trim() ? name.trim()[0] : '员';
    const subtitle = `${item.typeLabel || ''} · ${item.phone || '未填手机'}`;

    return {
      ...item,
      initial,
      subtitle,
      showManage: this._hasManageActions(item),
    };
  },

  _applyFilters() {
    const { rawList, keyword, activeFilter } = this.data;
    const kw = (keyword || '').trim().toLowerCase();

    let list = rawList.slice();
    if (kw) {
      list = list.filter((item) => {
        const name = (item.name || '').toLowerCase();
        const phone = (item.phone || '').toLowerCase();
        return name.includes(kw) || phone.includes(kw);
      });
    }

    if (activeFilter === 'bound') {
      list = list.filter((item) => item.bound);
    } else if (activeFilter === 'pending') {
      list = list.filter((item) => !item.bound);
    } else if (activeFilter === 'coach') {
      list = list.filter((item) => item.type === 'teacher');
    }

    const displayList = list.map((item) => this._decorateItem(item));
    const total = rawList.length;
    this.setData({
      displayList,
      navTitle: total ? `员工（${total}人）` : '员工',
    });
  },

  async _loadList() {
    const pid = pageHelper.getPID();
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/bind_admin_list',
        { pid },
        { hint: false, title: 'bar' },
      );
      const rawList = (res && res.list) || [];
      const selfOnly = !!(res && res.selfOnly);
      this.setData(
        {
          rawList,
          loading: false,
          selfOnly,
        },
        () => this._applyFilters(),
      );
    } catch (e) {
      console.error(e);
      wx.showToast({ title: (e && e.msg) || '加载失败', icon: 'none' });
      this.setData({ loading: false, rawList: [], displayList: [] });
    }
  },

  bindSearchInput(e) {
    this.setData({ keyword: e.detail.value || '' });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this._applyFilters(), 300);
  },

  bindSearchConfirm() {
    this._applyFilters();
  },

  bindFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeFilter) return;
    this.setData({ activeFilter: key }, () => this._applyFilters());
  },

  bindAddOpenTap() {
    if (!this.data.canManage) return;
    this.setData({
      addShow: true,
      addForm: { name: '', phone: '' },
    });
  },

  bindAddCloseTap() {
    this.setData({ addShow: false });
  },

  bindAddInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`addForm.${field}`]: e.detail });
  },

  async bindAddSubmitTap() {
    const { addForm, submitting, canManage } = this.data;
    if (!canManage || submitting) return;

    const name = (addForm.name || '').trim();
    const phone = (addForm.phone || '').trim();
    if (!name || !phone) {
      wx.showToast({ title: '请填写姓名和手机号', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/staff_insert',
        {
          pid: pageHelper.getPID(),
          name,
          phone,
        },
        { title: '添加中' },
      );
      wx.showToast({ title: '已添加', icon: 'success' });
      this.setData({ addShow: false, submitting: false });
      this._loadList();
    } catch (e) {
      console.error(e);
      this.setData({ submitting: false });
    }
  },

  bindActionTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.displayList[index];
    if (!item) return;
    this._openManageSheet(item);
  },

  _openManageSheet(item) {
    const actions = [];
    const handlers = [];

    if (item.canGenCode) {
      actions.push('发送绑定邀请');
      handlers.push('invite');
    }
    if (item.canUnbind) {
      actions.push('解除绑定');
      handlers.push('unbind');
    }
    if (item.canDelete) {
      actions.push('删除账号');
      handlers.push('delete');
    }
    if (!actions.length) return;

    wx.showActionSheet({
      itemList: actions,
      success: (res) => {
        const action = handlers[res.tapIndex];
        if (action === 'invite') {
          this._genInvite(item.id, item.name);
        } else if (action === 'unbind') {
          this._unbind(item.id, item.name);
        } else if (action === 'delete') {
          this._delete(item.id, item.name);
        }
      },
    });
  },

  async _genInvite(id, name) {
    if (!id) return;
    try {
      const res = await cloudHelper.callCloudSumbit(
        'admin/bind_code_gen',
        { adminId: id },
        { title: '生成中' },
      );
      const data = (res && res.data) || {};
      const path = data.bindPath || '';
      wx.showModal({
        title: '绑定邀请已生成（24小时有效）',
        content: `员工：${name}\n\n转发以下路径给员工扫码绑定：\n${path}\n\n开发者工具：启动参数 code=${data.code}`,
        confirmText: '复制路径',
        success: (r) => {
          if (r.confirm && path) wx.setClipboardData({ data: path });
        },
      });
    } catch (err) {
      console.error(err);
    }
  },

  async _unbind(id, name) {
    wx.showModal({
      title: '解除绑定',
      content: `确认解除「${name}」的微信绑定？`,
      confirmText: '解绑',
      confirmColor: '#e54d42',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await AdminWxBiz.unbind(id);
          wx.showToast({ title: '已解绑', icon: 'success' });
          if (this.data.selfOnly) {
            setTimeout(() => {
              wx.switchTab({ url: '/pages/default/my/index/my_index' });
            }, 800);
            return;
          }
          this._loadList();
        } catch (err) {
          console.error(err);
        }
      },
    });
  },

  async _delete(id, name) {
    wx.showModal({
      title: '删除空账号',
      content: `确认删除待绑定账号「${name}」？`,
      confirmText: '删除',
      confirmColor: '#e54d42',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await cloudHelper.callCloudSumbit(
            'admin/mgr_del',
            { adminId: id },
            { title: '删除中' },
          );
          wx.showToast({ title: '已删除', icon: 'success' });
          this._loadList();
        } catch (err) {
          console.error(err);
        }
      },
    });
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    await this._loadCoachData();
  },

  async _loadCoachData() {
    this._syncRoleFlags();
    await this._loadList();
  },

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },
});
