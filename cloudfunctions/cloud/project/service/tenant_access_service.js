const BaseService = require("./base_service.js");
const TenantModel = require("../model/tenant_model.js");
const AdminModel = require("../model/admin_model.js");
const tenantExpireUtil = require("../utils/tenant_expire_util.js");
const appCode = require("../../framework/core/app_code.js");

class TenantAccessService extends BaseService {
  async _isSuperToken(token) {
    if (!token) return false;
    const BaseAdminService = require("./admin/base_admin_service.js");
    const admin = await new BaseAdminService()._tryTokenAdmin(token);
    return !!(admin && admin.ADMIN_TYPE === AdminModel.TYPE.SUPER);
  }

  async assertActive(pid, { token } = {}) {
    pid = String(pid || "").trim();
    if (!pid) return;
    if (await this._isSuperToken(token)) return;

    const tenant = await TenantModel.getOne(
      { _pid: pid },
      "TENANT_NAME,TENANT_STATUS,TENANT_EXPIRE_TIME",
      {},
      false,
    );
    if (!tenant) this.AppError("瑜伽馆不存在", appCode.LOGIC);
    if (tenant.TENANT_STATUS !== TenantModel.STATUS.OPEN) {
      this.AppError("瑜伽馆已关闭", appCode.LOGIC);
    }
    if (tenantExpireUtil.isExpired(tenant.TENANT_EXPIRE_TIME)) {
      this.AppError(
        `「${tenant.TENANT_NAME}」服务已到期，请联系平台续期`,
        appCode.LOGIC,
      );
    }
  }
}

module.exports = TenantAccessService;
