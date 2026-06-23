const cloudHelper = require('../helper/cloud_helper.js');
const pageHelper = require('../helper/page_helper.js');
const AdminBiz = require('./admin_biz.js');

class AdminWxBiz {
  /** 密码登录 token 是否仍有效（超管 / 馆长备用密码） */
  static hasPasswordSession() {
    const admin = AdminBiz.getAdminToken();
    return !!(admin && admin.token);
  }

  static isSuperSession() {
    const admin = AdminBiz.getAdminToken();
    return !!(admin && admin.type === 'super' && admin.token);
  }

  /** 静默刷新 admin token（微信绑定 或 密码 token） */
  static async ensureSession() {
    const admin = AdminBiz.getAdminToken();
    if (admin && admin.token) {
      if (admin.type === 'super') {
        return AdminWxBiz._alignSuperTenantPid();
      }
      return true;
    }

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
    return false;
  }

  /** 超管：确保已选馆（教练版 API 依赖 PID） */
  static async _alignSuperTenantPid() {
    const list = await AdminWxBiz.fetchTenantList();
    if (!list.length) return false;

    const pid = pageHelper.getPID();
    if (pid && list.some((t) => t._pid === pid)) return true;

    pageHelper.setTenant(list[0]);
    return true;
  }

  /** 可管理的馆列表（超管=全部馆，其他=微信绑定馆） */
  static async fetchTenantList() {
    if (AdminWxBiz.isSuperSession()) {
      try {
        const res = await cloudHelper.callCloudData(
          'tenant/list',
          {},
          { hint: false, title: 'bar' },
        );
        const admin = AdminBiz.getAdminToken();
        return ((res && res.list) || []).map((t) => ({
          ...t,
          adminType: 'super',
          adminName: admin ? admin.name : '',
          roleLabel: '超管',
        }));
      } catch (e) {
        console.error('[AdminWxBiz.fetchTenantList super]', e);
        return [];
      }
    }

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

  /** 进入教练版前：微信绑定 或 超管密码 token */
  static async prepareCoachEntry() {
    if (AdminWxBiz.isSuperSession()) {
      const ok = await AdminWxBiz._alignSuperTenantPid();
      if (!ok) {
        wx.showModal({
          title: '暂无瑜伽馆',
          content: '请先新建瑜伽馆',
          showCancel: false,
        });
      }
      return ok;
    }

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
    if (!AdminWxBiz.isSuperSession()) {
      await AdminWxBiz.ensureSession();
    }
    wx.showToast({
      title: '已选择「' + item.TENANT_NAME + '」',
      icon: 'none',
      duration: 800,
    });
  }

  /** 退出超管密码模式，尝试恢复微信绑定的教练/馆主会话 */
  static async exitSuperMode() {
    if (!AdminWxBiz.isSuperSession()) return false;
    AdminBiz.clearAdminToken();
    return AdminWxBiz.ensureSession();
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
