/**
 * Notes: 租户模块业务逻辑
 */

const BaseService = require("./base_service.js");
const TenantModel = require("../model/tenant_model.js");
const tenantSetupHelper = require("./tenant_setup_helper.js");

class TenantService extends BaseService {
  async getTenantList() {
    let where = {
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    let fields =
      "_pid,TENANT_ID,TENANT_NAME,TENANT_LOGO,TENANT_DESC,TENANT_TEMPLATE,TENANT_MEET_TYPE,TENANT_MEET_NAME,TENANT_THEME_COLOR";
    let orderBy = { TENANT_ADD_TIME: "asc" };

    let list = await TenantModel.getAll(where, fields, orderBy, 100, false);
    let merged = [];
    for (let tenant of list || []) {
      merged.push(await tenantSetupHelper.getMergedTenant(tenant._pid, tenant));
    }
    return merged;
  }

  async getTenantDetail(pid) {
    let where = {
      _pid: pid,
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    let tenant = await TenantModel.getOne(where, "*", {}, false);
    if (!tenant) return null;
    return await tenantSetupHelper.getMergedTenant(pid, tenant);
  }
}

module.exports = TenantService;
