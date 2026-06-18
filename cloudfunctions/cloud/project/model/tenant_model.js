/**
 * Notes: 租户实体
 */

const BaseModel = require("./base_model.js");

class TenantModel extends BaseModel {}

TenantModel.CL = "ax_tenant";

TenantModel.DB_STRUCTURE = {
  _pid: "string|true",
  TENANT_ID: "string|true",

  TENANT_NAME: "string|true|comment=瑜伽馆名称",
  TENANT_LOGO: "string|false|comment=馆LOGO cloudId",
  TENANT_DESC: "string|false|comment=简介",
  TENANT_TEMPLATE: "string|true|default=default|comment=页面模板ID，如 default/A00",
  TENANT_STATUS: "int|true|default=1|comment=0=关闭 1=开放",

  TENANT_ADD_TIME: "int|true",
  TENANT_EDIT_TIME: "int|true",
  TENANT_ADD_IP: "string|false",
  TENANT_EDIT_IP: "string|false",
};

TenantModel.FIELD_PREFIX = "TENANT_";

TenantModel.STATUS = {
  CLOSE: 0,
  OPEN: 1,
};

module.exports = TenantModel;
