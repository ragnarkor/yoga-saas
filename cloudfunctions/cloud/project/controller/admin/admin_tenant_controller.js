/**
 * Notes: 租户门店管理控制器
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminTenantService = require("../../service/admin/admin_tenant_service.js");

class AdminTenantController extends BaseAdminController {
  /** 门店信息 + 课程分类 */
  async getStore() {
    await this.isAdmin();
    let pid = global.PID || this.getParameter("pid") || "";
    let service = new AdminTenantService();
    return await service.getStore(pid);
  }

  /** 保存课程分类（馆主/超管） */
  async saveMeetCategories() {
    await this.isAdmin();
    let rules = {
      categories: "must|array|name=课程分类",
      themeColor: "string|false|name=主题色",
      tenantDesc: "string|false|name=品牌简介",
    };
    let input = this.validateData(rules);
    let pid = global.PID || this.getParameter("pid") || "";
    let service = new AdminTenantService();
    return await service.saveMeetCategories(
      pid,
      input.categories,
      this._adminType,
      input.themeColor,
      input.tenantDesc,
    );
  }

  /** 客户 Tab 会员统计 */
  async getMemberStats() {
    await this.isAdmin();
    let pid = global.PID || this.getParameter("pid") || "";
    let service = new AdminTenantService();
    return await service.getMemberStats(pid);
  }
}

module.exports = AdminTenantController;
