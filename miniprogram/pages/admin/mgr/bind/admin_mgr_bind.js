const AdminBiz = require('../../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../../biz/admin_wx_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');

Page({
  data: {
    list: [],
    loading: true,
    tenantName: '',
    roleTip: '超管可管理馆长/教练；馆长可查看全员绑定状态并管理教练。',
  },

  onLoad() {
    this._initPage();
  },

  onShow() {
    this.setData({ tenantName: pageHelper.getTenantName() });
    if (AdminBiz.getAdminToken() && pageHelper.getPID()) {
      this._loadList();
    }
  },

  async _initPage() {
    await AdminWxBiz.ensureSession();
    if (!AdminBiz.getAdminToken()) {
      wx.redirectTo({ url: '/pages/admin/index/login/admin_login' });
      return;
    }
    if (!pageHelper.getPID()) {
      wx.showModal({
        title: '提示',
        content: '请先在后台首页选择要管理的瑜伽馆',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }
    this.setData({ tenantName: pageHelper.getTenantName() });
    this._loadList();
  },

  async _loadList() {
    const pid = pageHelper.getPID();
    try {
      const res = await cloudHelper.callCloudData(
        'admin/bind_admin_list',
        { pid },
        { hint: false, title: 'bar' },
      );
      const list = (res && res.list) || [];
      const admin = AdminBiz.getAdminToken();
      let roleTip = '超管可管理馆长/教练；馆长可查看全员绑定状态并管理教练。';
      if (admin && admin.type === 'owner') {
        roleTip = '馆长可查看本馆所有账号绑定状态；馆长绑定码需超管生成。';
      }
      this.setData({
        list,
        loading: false,
        roleTip,
      });
    } catch (e) {
      console.error(e);
      wx.showToast({
        title: (e && e.msg) || '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
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
        title: '绑定码已生成（24小时有效）',
        content: `管理员：${name}\n\n小程序路径：\n${path}\n\n开发者工具：编译模式填入启动参数 code=${data.code}`,
        confirmText: '复制路径',
        success: (r) => {
          if (r.confirm && path) {
            wx.setClipboardData({ data: path });
          }
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
    if (!id) return;

    if (!bound) {
      wx.showToast({ title: '该账号尚未绑定微信', icon: 'none' });
      return;
    }
    if (!canUnbind) {
      wx.showToast({ title: '无权限解绑该账号', icon: 'none' });
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

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },
});
