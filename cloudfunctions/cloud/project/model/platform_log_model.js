/**
 * Notes: 平台超管操作审计日志实体
 * 用途：记录跨租户的平台级操作（建馆/删馆/改到期/改状态/加员工等），
 *       固定落在 _pid = PLATFORM_PID，与馆级 ax_log 分离，便于合规审计与溯源。
 */

const BaseModel = require("./base_model.js");

class PlatformLogModel extends BaseModel {}

// 集合名
PlatformLogModel.CL = "ax_platform_log";

// 平台级日志的固定隔离键（不随 global.PID 漂移）
PlatformLogModel.PLATFORM_PID = "PLATFORM";

PlatformLogModel.DB_STRUCTURE = {
  _pid: "string|true",
  PLOG_ID: "string|true",

  // 操作人快照
  PLOG_ADMIN_ID: "string|true|comment=操作人管理员ID",
  PLOG_ADMIN_NAME: "string|false|comment=操作人姓名",
  PLOG_ADMIN_PHONE: "string|false|comment=操作人手机号",
  PLOG_ADMIN_TYPE: "string|false|comment=操作人角色 super/owner/teacher",

  // 动作
  PLOG_ACTION: "string|true|comment=动作码 见 ACTION 常量",
  PLOG_CONTENT: "string|true|comment=可读描述",

  // 操作对象（目标租户）
  PLOG_TARGET_PID: "string|false|comment=目标租户_pid",
  PLOG_TARGET_NAME: "string|false|comment=目标租户名称",

  // 变更前后（可选，字符串快照）
  PLOG_BEFORE: "string|false|comment=变更前值",
  PLOG_AFTER: "string|false|comment=变更后值",

  PLOG_ADD_TIME: "int|true",
  PLOG_EDIT_TIME: "int|true",
  PLOG_ADD_IP: "string|false",
  PLOG_EDIT_IP: "string|false",
};

// 字段前缀
PlatformLogModel.FIELD_PREFIX = "PLOG_";

// 动作码
PlatformLogModel.ACTION = {
  TENANT_INSERT: "tenant_insert", // 新建瑜伽馆
  TENANT_DEL: "tenant_del", // 删除瑜伽馆
  TENANT_EXPIRE: "tenant_expire", // 修改有效期
  TENANT_STATUS: "tenant_status", // 启用/停用
  STAFF_INSERT: "staff_insert", // 平台/馆内新建员工
};

PlatformLogModel.ACTION_DESC = {
  tenant_insert: "新建瑜伽馆",
  tenant_del: "删除瑜伽馆",
  tenant_expire: "修改有效期",
  tenant_status: "启用/停用",
  staff_insert: "新建员工",
};

module.exports = PlatformLogModel;
