// [AI_START TIMESTAMP=2025-01-25 10:00:00]
/**
 * Notes: 租户模块控制器
 * Date: 2025-01-25
 */

const BaseController = require("./base_controller.js");
const TenantService = require("../service/tenant_service.js");

class TenantController extends BaseController {
  /** 获取租户列表（无需登录） */
  async getTenantList() {
    let service = new TenantService();
    let list = await service.getTenantList();
    return { list };
  }

  /** 获取单个租户详情 */
  async getTenantDetail() {
    let rules = {
      pid: "must|string|name=租户ID",
    };
    let input = this.validateData(rules);
    let service = new TenantService();
    let tenant = await service.getTenantDetail(input.pid);
    return { tenant };
  }
}

module.exports = TenantController;
// [AI_END LINES=28 TIMESTAMP=2025-01-25 10:00:00]
