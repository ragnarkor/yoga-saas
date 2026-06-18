// [AI_START TIMESTAMP=2025-01-25 10:00:00]
/**
 * Notes: 租户模块业务逻辑
 * Date: 2025-01-25
 */

const BaseService = require("./base_service.js");
const TenantModel = require("../model/tenant_model.js");

class TenantService extends BaseService {
  /** 获取租户列表（开放中的） */
  async getTenantList() {
    let where = {
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    let fields = "_pid,TENANT_ID,TENANT_NAME,TENANT_LOGO,TENANT_DESC";
    let orderBy = { TENANT_ADD_TIME: "asc" };

    return await TenantModel.getAll(where, fields, orderBy, false);
  }

  /** 获取单个租户详情 */
  async getTenantDetail(pid) {
    let where = {
      _pid: pid,
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    let fields = "*";
    return await TenantModel.getOne(where, fields, {}, false);
  }
}

module.exports = TenantService;
// [AI_END LINES=39 TIMESTAMP=2025-01-25 10:00:00]
