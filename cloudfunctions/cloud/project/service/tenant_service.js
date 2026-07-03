/**
 * Notes: 租户模块业务逻辑
 */

const BaseService = require("./base_service.js");
const TenantModel = require("../model/tenant_model.js");
const tenantSetupHelper = require("./tenant_setup_helper.js");
const tenantExpireUtil = require("../utils/tenant_expire_util.js");
const timeUtil = require("../../framework/utils/time_util.js");

class TenantService extends BaseService {
  async getTenantList() {
    let where = {
      TENANT_STATUS: TenantModel.STATUS.OPEN,
    };
    let fields =
      "_pid,TENANT_ID,TENANT_NAME,TENANT_LOGO,TENANT_DESC,TENANT_TEMPLATE,TENANT_MEET_TYPE,TENANT_MEET_NAME,TENANT_THEME_COLOR,TENANT_EXPIRE_TIME";
    let orderBy = { TENANT_ADD_TIME: "asc" };

    let list = await TenantModel.getAll(where, fields, orderBy, 100, false);
    const now = timeUtil.time();
    let merged = [];
    for (let tenant of list || []) {
      if (tenantExpireUtil.isExpired(tenant.TENANT_EXPIRE_TIME, now)) continue;
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
    if (tenantExpireUtil.isExpired(tenant.TENANT_EXPIRE_TIME)) return null;
    return await tenantSetupHelper.getMergedTenant(pid, tenant);
  }

  /** 校验租户是否可访问（未关闭且未到期） */
  async checkTenantAccess(pid) {
    pid = String(pid || "").trim();
    if (!pid) {
      return { active: false, reason: "not_found" };
    }
    let tenant = await TenantModel.getOne(
      {
        _pid: pid,
        TENANT_STATUS: TenantModel.STATUS.OPEN,
      },
      "TENANT_NAME,TENANT_EXPIRE_TIME",
      {},
      false,
    );
    if (!tenant) {
      return { active: false, reason: "not_found" };
    }
    if (tenantExpireUtil.isExpired(tenant.TENANT_EXPIRE_TIME)) {
      return {
        active: false,
        reason: "expired",
        tenantName: tenant.TENANT_NAME,
      };
    }
    return { active: true };
  }
}

module.exports = TenantService;
