const BaseModel = require("./base_model.js");

class TeacherModel extends BaseModel {}

TeacherModel.CL = "ax_teacher";

TeacherModel.DB_STRUCTURE = {
  _pid: "string|true",
  TEACHER_ID: "string|true",
  TEACHER_ADMIN_ID: "string|false|comment=关联管理员_id，绑定微信后创建",
  TEACHER_NAME: "string|true|comment=姓名",
  TEACHER_AVATAR: "string|false|comment=头像",
  TEACHER_PIC: "array|false|default=[]|comment=教学照片",
  TEACHER_SPECIALTY: "string|false|comment=擅长课程",
  TEACHER_DESC: "string|false|comment=简介",
  TEACHER_HOME: "int|true|default=1|comment=是否首页展示",
  TEACHER_ORDER: "int|true|default=9999",
  TEACHER_STATUS: "int|true|default=1|comment=0/1",
  TEACHER_ADD_TIME: "int|true",
  TEACHER_EDIT_TIME: "int|true",
  TEACHER_ADD_IP: "string|false",
  TEACHER_EDIT_IP: "string|false",
};

TeacherModel.FIELD_PREFIX = "TEACHER_";

module.exports = TeacherModel;
