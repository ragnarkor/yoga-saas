/**
 * Notes: 系统管理员实体
 * Date: 2021-03-15 19:20:00
 */

const BaseModel = require("./base_model.js");

class AdminModel extends BaseModel {}

// 集合名
AdminModel.CL = "ax_admin";

AdminModel.DB_STRUCTURE = {
  _pid: "string|true",
  ADMIN_ID: "string|true",
  ADMIN_NAME: "string|true",
  ADMIN_PHONE: "string|true|comment=登录手机号",
  ADMIN_STATUS: "int|true|default=1|comment=状态：0=禁用 1=启用",

  ADMIN_LOGIN_CNT: "int|true|default=0|comment=登录次数",
  ADMIN_LOGIN_TIME: "int|true|default=0|comment=最后登录时间",
  // [AI_START TIMESTAMP=2025-01-25 10:00:00]
  ADMIN_TYPE:
    "string|true|default=teacher|comment=角色 owner=馆长 teacher=教师",
  ADMIN_PWD: "string|true|comment=登录密码",
  // [AI_END LINES=2 TIMESTAMP=2025-01-25 10:00:00]

  ADMIN_TOKEN: "string|false|comment=当前登录token",
  ADMIN_TOKEN_TIME: "int|true|default=0|comment=当前登录token time",

  ADMIN_ADD_TIME: "int|true",
  ADMIN_EDIT_TIME: "int|true",
  ADMIN_ADD_IP: "string|false",
  ADMIN_EDIT_IP: "string|false",
};

// 字段前缀
AdminModel.FIELD_PREFIX = "ADMIN_";

// [AI_START TIMESTAMP=2025-01-25 10:00:00]
// 命名角色常量（替代 0/1 数字）
AdminModel.TYPE = {
  SUPER: "super", // 超级管理员：平台级，管理所有馆（_pid=admin，不绑定租户）
  OWNER: "owner", // 馆长：单个馆的完整管理权限
  TEACHER: "teacher", // 教师：只能管理自己创建的课程
};
// [AI_END LINES=5 TIMESTAMP=2025-01-25 10:00:00]

module.exports = AdminModel;
