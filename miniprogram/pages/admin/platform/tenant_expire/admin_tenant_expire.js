const AdminBiz = require('../../../../biz/admin_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');
const tenantExpireHelper = require('../../../../helper/tenant_expire_helper.js');

Page({
  data: {
    pid: '',
    tenantName: '',
    expireMode: 'long',
    expireDay: '',
    minExpireDay: tenantExpireHelper.todayYMD(),
    tenantStatus: 1,
    isClosed: false,
    statusDesc: '',
    deleteConfirmName: '',
    loading: true,
    submitting: false,
    statusSubmitting: false,
    deleting: false,
  },

  onLoad(options) {
    if (!AdminBiz.getAdminToken() || !AdminBiz.isSuperAdmin()) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    const pid = options.pid || '';
    const tenantName = options.name ? decodeURIComponent(options.name) : '';
    this.setData({ pid, tenantName });
    if (pid) this._loadDetail(pid);
    else this.setData({ loading: false });
  },

  async _loadDetail(pid) {
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_expire_detail',
        { pid },
        { hint: false, title: 'bar' },
      );
      const expireMode = res && res.isLongTerm ? 'long' : 'date';
      this.setData({
        loading: false,
        tenantName: (res && res.TENANT_NAME) || this.data.tenantName,
        expireMode,
        expireDay: (res && res.expireDay) || tenantExpireHelper.todayYMD(),
        tenantStatus: (res && res.TENANT_STATUS) != null ? res.TENANT_STATUS : 1,
        isClosed: !!(res && res.isClosed),
        statusDesc: (res && res.statusDesc) || '',
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  bindExpireModeTap(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.expireMode) return;
    this.setData({
      expireMode: mode,
      expireDay: mode === 'date' ? tenantExpireHelper.todayYMD() : '',
    });
  },

  bindExpireDayChange(e) {
    this.setData({ expireDay: e.detail.value });
  },

  bindStatusSwitch(e) {
    const enabled = !!e.detail.value;
    this.setData({
      tenantStatus: enabled ? 1 : 0,
      isClosed: !enabled,
    });
  },

  bindDeleteNameInput(e) {
    this.setData({ deleteConfirmName: e.detail.value });
  },

  bindFeatureTap() {
    const { pid, tenantName } = this.data;
    if (!pid) return;
    wx.navigateTo({
      url: `/pages/admin/setup/feature/admin_setup_feature?pid=${pid}&name=${encodeURIComponent(tenantName)}`,
    });
  },

  async bindSaveExpire() {
    const { pid, expireMode, expireDay, submitting } = this.data;
    if (!pid || submitting) return;

    this.setData({ submitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/tenant_expire_save',
        {
          pid,
          expireDay: expireMode === 'long' ? 'long' : expireDay,
        },
        { title: '保存中' },
      );
      pageHelper.showSuccToast('有效期已保存');
      await this._loadDetail(pid);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async bindSaveStatus() {
    const { pid, tenantStatus, statusSubmitting } = this.data;
    if (!pid || statusSubmitting) return;

    const action = tenantStatus === 1 ? '启用' : '立即停用';
    const ok = await pageHelper.showConfirm(
      `确认${action}「${this.data.tenantName}」？${tenantStatus === 0 ? '停用后会员与教练端将无法使用该馆。' : ''}`,
    );
    if (!ok) {
      await this._loadDetail(pid);
      return;
    }

    this.setData({ statusSubmitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/tenant_status_save',
        { pid, status: tenantStatus },
        { title: '保存中' },
      );
      pageHelper.showSuccToast(tenantStatus === 1 ? '已启用' : '已停用');
      await this._loadDetail(pid);
    } catch (e) {
      console.error(e);
      await this._loadDetail(pid);
    } finally {
      this.setData({ statusSubmitting: false });
    }
  },

  async bindDeleteTenant() {
    const { pid, tenantName, deleteConfirmName, deleting } = this.data;
    if (!pid || deleting) return;
    if (!deleteConfirmName) {
      return wx.showToast({ title: '请输入馆名确认', icon: 'none' });
    }
    if (deleteConfirmName !== tenantName) {
      return wx.showToast({ title: '馆名不一致', icon: 'none' });
    }

    const ok = await pageHelper.showConfirm(
      `确认永久删除「${tenantName}」？将移除馆配置与管理员账号，业务数据仍保留在库中。`,
    );
    if (!ok) return;

    this.setData({ deleting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/tenant_del',
        { pid, confirmName: deleteConfirmName },
        { title: '删除中' },
      );
      pageHelper.showSuccToast('已删除', 1200, () => wx.navigateBack());
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ deleting: false });
    }
  },
});
