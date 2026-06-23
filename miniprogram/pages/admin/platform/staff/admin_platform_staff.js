const AdminBiz = require('../../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../../biz/admin_wx_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const adminTheme = require('../../../../helper/admin_theme.js');

Page({
  data: {
    loading: true,
    list: [],
    stats: { total: 0, bound: 0, pending: 0 },
  },

  onLoad() {
    if (!AdminBiz.getAdminToken() || !AdminBiz.isSuperAdmin()) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    wx.setNavigationBarColor({
      backgroundColor: adminTheme.NAV_BG,
      frontColor: '#ffffff',
    });
    this._loadList();
  },

  onShow() {
    wx.setNavigationBarColor({
      backgroundColor: adminTheme.NAV_BG,
      frontColor: '#ffffff',
    });
    if (AdminBiz.isSuperAdmin() && !this.data.loading) {
      this._loadList();
    }
  },

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },

  async _loadList() {
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/platform_staff_list',
        {},
        { title: 'bar' },
      );
      const list = (res && res.list) || [];
      const stats = (res && res.stats) || {
        total: list.length,
        bound: list.filter((x) => x.bound).length,
        pending: 0,
      };
      this.setData({ list, stats, loading: false });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, list: [] });
    }
  },

  bindAddTap() {
    wx.navigateTo({ url: '/pages/admin/platform/mgr_form/admin_mgr_form' });
  },

  async bindGenTap(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
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
        content: `员工：${name}\n\n转发以下路径给员工扫码绑定：\n${path}`,
        confirmText: '复制路径',
        success: (r) => {
          if (r.confirm && path) wx.setClipboardData({ data: path });
        },
      });
    } catch (err) {
      console.error(err);
    }
  },

  async bindUnbindTap(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const bound = e.currentTarget.dataset.bound;
    const canUnbind = e.currentTarget.dataset.canUnbind;
    if (!id || !bound || !canUnbind) {
      wx.showToast({ title: '无法解绑', icon: 'none' });
      return;
    }
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
          this._loadList();
        } catch (err) {
          console.error(err);
        }
      },
    });
  },

  async bindDeleteTap(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const canDelete = e.currentTarget.dataset.canDelete;
    if (!id || !canDelete) {
      wx.showToast({ title: '无法删除', icon: 'none' });
      return;
    }
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
});
