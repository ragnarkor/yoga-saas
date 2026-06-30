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
      tenantName: "string|max:30|name=门店名称",
      tenantLogo: "string|false|name=门店LOGO",
      about: "string|max:50000|name=门店介绍",
      aboutPic: "array|false|name=介绍图片",
      contactPhone: "string|max:30|name=联系电话",
      contactAddress: "string|max:200|name=门店地址",
      contactLatitude: "string|false|name=纬度",
      contactLongitude: "string|false|name=经度",
      privateSchedule: "object|false|name=私教预约规则",
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
      input.tenantName,
      input.tenantLogo,
      input.about,
      input.aboutPic,
      input.contactPhone,
      input.contactAddress,
      input.contactLatitude,
      input.contactLongitude,
      input.privateSchedule,
    );
  }

  /** 客户 Tab 会员统计 */
  async getMemberStats() {
    await this.isAdmin();
    let pid = global.PID || this.getParameter("pid") || "";
    let service = new AdminTenantService();
    return await service.getMemberStats(pid);
  }

  async getAttentionMembers() {
    await this.isAdmin();
    let rules = {
      type: "required|string|name=关注类型",
      search: "string|false|max:30|name=搜索条件",
      page: "required|int|default=1",
      size: "int|default=100",
    };
    let input = this.validateData(rules);
    let service = new AdminTenantService();
    return await service.getAttentionMembers(input);
  }

  /** 超管：平台概览 */
  async getPlatformOverview() {
    await this.isSuperAdmin();
    let service = new AdminTenantService();
    return await service.getPlatformOverview();
  }

  /** 超管：新建瑜伽馆 */
  async insertTenant() {
    await this.isSuperAdmin();
    let rules = {
      name: "must|string|min:1|max:30|name=瑜伽馆名称",
      desc: "string|max:200|name=简介",
      template: "string|default=default|name=页面模板",
    };
    let input = this.validateData(rules);
    let service = new AdminTenantService();
    return await service.insertTenant(
      input.name,
      input.desc,
      input.template,
      this._admin,
    );
  }
}

module.exports = AdminTenantController;
