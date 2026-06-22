const cloudHelper = require('../helper/cloud_helper.js');
const pageHelper = require('../helper/page_helper.js');
const AdminBiz = require('./admin_biz.js');

class AdminWxBiz {
  /** 静默刷新 admin token（openid 已绑定当前馆） */
  static async ensureSession() {
    const pid = pageHelper.getPID();
    if (!pid) return false;

    try {
      const res = await cloudHelper.callCloudData(
        'admin/wx_session',
        {},
        { hint: false, title: 'bar' },
      );
      if (res && res.token) {
        AdminBiz.adminLogin(res);
        return true;
      }
    } catch (e) {
      console.error('[AdminWxBiz.ensureSession]', e);
    }
    return !!AdminBiz.getAdminToken();
  }

  /** 已绑定微信的管理员可管理的馆列表 */
  static async fetchTenantList() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/wx_tenant_list',
        {},
        { hint: false, title: 'bar' },
      );
      return (res && res.list) || [];
    } catch (e) {
      console.error('[AdminWxBiz.fetchTenantList]', e);
      return [];
    }
  }

  /** 进入教练版前：校验绑定馆、对齐 PID、静默登录 */
  static async prepareCoachEntry() {
    const list = await AdminWxBiz.fetchTenantList();
    if (!list.length) {
      wx.showModal({
        title: '尚未绑定',
        content:
          '请使用管理员提供的绑定链接完成微信绑定。\n\n开发者工具：编译模式打开 pages/admin/bind/admin_bind?code=绑定码',
        showCancel: false,
      });
      return false;
    }

    let pid = pageHelper.getPID();
    let matched = list.find((t) => t._pid === pid);
    if (!matched) {
      matched = list[0];
      pageHelper.setTenant(matched);
      pid = matched._pid;
    }

    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      return false;
    }
    return true;
  }

  /** 教练版切换有权限的馆 */
  static async switchTenant(item) {
    if (!item || !item._pid) return;
    pageHelper.setTenant(item);
    await AdminWxBiz.ensureSession();
    wx.showToast({
      title: '已选择「' + item.TENANT_NAME + '」',
      icon: 'none',
      duration: 800,
    });
  }

  /** 解除当前馆微信绑定；adminId 可选，超管/馆长代解绑 */
  static async unbind(adminId) {
    const params = adminId ? { adminId } : {};
    await cloudHelper.callCloudSumbit('admin/wx_unbind', params, {
      title: '解绑中',
    });
    AdminBiz.clearAdminToken();
  }
}

module.exports = AdminWxBiz;
