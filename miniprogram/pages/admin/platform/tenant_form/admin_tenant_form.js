const AdminBiz = require('../../../../biz/admin_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');

Page({
  data: {
    name: '',
    desc: '',
    submitting: false,
  },

  onLoad() {
    if (!AdminBiz.getAdminToken() || !AdminBiz.isSuperAdmin()) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
    }
  },

  bindInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  async bindSubmit() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写馆名', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/tenant_insert',
        {
          name,
          desc: (this.data.desc || '').trim(),
          template: 'default',
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
