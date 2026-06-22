/**
 * Notes: 租户模块业务逻辑
 */

const BaseService = require("./base_service.js");
const TenantModel = require("../model/tenant_model.js");

class TenantService extends BaseService {
  async getTenantList() {
    let where = {
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    let fields =
      "_pid,TENANT_ID,TENANT_NAME,TENANT_LOGO,TENANT_DESC,TENANT_TEMPLATE,TENANT_MEET_TYPE,TENANT_MEET_NAME,TENANT_THEME_COLOR";
    let orderBy = { TENANT_ADD_TIME: "asc" };

    // 第4个参数 size(条数) 不能传 false；第5个参数 mustPID=false 表示跨租户全局列出（租户选择页需列出所有馆，不能按 _pid='ONE' 过滤）
    return await TenantModel.getAll(where, fields, orderBy, 100, false);
  }

  async getTenantDetail(pid) {
    let where = {
      _pid: pid,
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    return await TenantModel.getOne(where, "*", {}, false);
  }
}

module.exports = TenantService;
