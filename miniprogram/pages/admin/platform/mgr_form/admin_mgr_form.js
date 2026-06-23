const AdminBiz = require('../../../../biz/admin_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');

Page({
  data: {
    tenantList: [],
    tenantIndex: 0,
    name: '',
    phone: '',
    pwd: '',
    roleIndex: 0,
    roleOptions: [
      { label: '馆长', value: 'owner' },
      { label: '教练', value: 'teacher' },
    ],
    submitting: false,
  },

  onLoad() {
    if (!AdminBiz.getAdminToken() || !AdminBiz.isSuperAdmin()) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this._loadTenants();
  },

  async _loadTenants() {
    try {
      const res = await cloudHelper.callCloudData('admin/platform_overview', {}, { title: 'bar' });
      const list = (res && res.tenantList) || [];
      if (!list.length) {
        wx.showModal({
          title: '提示',
          content: '请先创建瑜伽馆',
          showCancel: false,
          success: () => wx.navigateBack(),
        });
        return;
      }
      this.setData({ tenantList: list, tenantIndex: 0 });
    } catch (e) {
      console.error(e);
    }
  },

  bindInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  bindTenantChange(e) {
    this.setData({ tenantIndex: Number(e.detail.value) || 0 });
  },

  bindRoleChange(e) {
    this.setData({ roleIndex: Number(e.detail.value) || 0 });
  },

  async bindSubmit() {
    const { tenantList, tenantIndex, roleOptions, roleIndex } = this.data;
    const tenant = tenantList[tenantIndex];
    if (!tenant) return;

    const name = (this.data.name || '').trim();
    const phone = (this.data.phone || '').trim();
    const pwd = (this.data.pwd || '').trim();

    if (!name || !phone) {
      wx.showToast({ title: '请填写姓名和手机号', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/mgr_insert',
        {
          pid: tenant._pid,
          name,
          phone,
          pwd,
          adminType: roleOptions[roleIndex].value,
        },
        { title: '创建中' },
      );
      pageHelper.showSuccToast('创建成功', 1200, () => wx.navigateBack());
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
